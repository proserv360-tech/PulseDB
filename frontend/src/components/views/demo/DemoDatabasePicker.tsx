/* ═══════════════════════════════════════════════════════════════════════════
   DemoDatabasePicker.tsx

   A searchable dropdown that replaces the horizontally-scrolling chip row
   in DemoLayout. All 12 demo databases are visible at once (no scroll-right
   needed), each with:
     • status dot (healthy / degraded / down)
     • category chip (SQL / NoSQL / Cloud)
     • short subtitle (the database vendor description)

   The picker also exposes:
     • a search box (filters by name / vendor / short)
     • category quick-filter chips (All / SQL / NoSQL / Cloud / Healthy / Issues)
     • a comparison toggle — when on, a second dropdown appears and the
       parent gets notified via `onCompareChange`.

   Visual language matches the live FleetOverviewTab — 12px radii, pulsing
   live dots, THEME tokens, glass borders.
   ═══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { THEME, metricValue } from '../../../utils/theme';
import {
    Search, ChevronDown, Check, GitCompare, X,
    Database, Activity, CheckCircle2, AlertTriangle,
} from 'lucide-react';

export type DbStatus = 'healthy' | 'degraded' | 'down';
export type DbCategory = 'SQL' | 'NoSQL' | 'Cloud';

export interface DbOption {
    id: string;          // e.g. 'demo-postgres'
    label: string;       // e.g. 'PostgreSQL'
    short: string;       // e.g. 'PG'
    vendor: string;      // e.g. 'PostgreSQL 16.2'
    category: DbCategory;
    status: DbStatus;
    color: string;       // accent
}

export const DEMO_DB_OPTIONS: DbOption[] = [
    { id: 'demo-postgres',      label: 'PostgreSQL',    short: 'PG', vendor: 'PostgreSQL 16.2',   category: 'SQL',   status: 'healthy',  color: '#336791' },
    { id: 'demo-mysql',         label: 'MySQL',         short: 'MY', vendor: 'MySQL 8.0',         category: 'SQL',   status: 'healthy',  color: '#00758F' },
    { id: 'demo-mongodb',       label: 'MongoDB',       short: 'MO', vendor: 'MongoDB 7.0',       category: 'NoSQL', status: 'healthy',  color: '#13AA52' },
    { id: 'demo-mssql',         label: 'SQL Server',    short: 'MS', vendor: 'Microsoft SQL 2022',category: 'SQL',   status: 'degraded', color: '#CC2927' },
    { id: 'demo-oracle',        label: 'Oracle',        short: 'OR', vendor: 'Oracle DB 21c',     category: 'SQL',   status: 'healthy',  color: '#F80000' },
    { id: 'demo-redis',         label: 'Redis',         short: 'RE', vendor: 'Redis 7.2',         category: 'NoSQL', status: 'healthy',  color: '#DC382D' },
    { id: 'demo-elasticsearch', label: 'Elasticsearch', short: 'ES', vendor: 'Elastic 8.13',      category: 'NoSQL', status: 'healthy',  color: '#005571' },
    { id: 'demo-snowflake',     label: 'Snowflake',     short: 'SF', vendor: 'Snowflake cloud',   category: 'Cloud', status: 'healthy',  color: '#29B5E8' },
    { id: 'demo-bigquery',      label: 'BigQuery',      short: 'BQ', vendor: 'Google BigQuery',   category: 'Cloud', status: 'healthy',  color: '#4285F4' },
    { id: 'demo-redshift',      label: 'Redshift',      short: 'RS', vendor: 'AWS Redshift',      category: 'Cloud', status: 'degraded', color: THEME.aiDark },
    { id: 'demo-cassandra',     label: 'Cassandra',     short: 'CA', vendor: 'Apache Cassandra 4',category: 'NoSQL', status: 'healthy',  color: '#1287B1' },
    { id: 'demo-dynamodb',      label: 'DynamoDB',      short: 'DY', vendor: 'AWS DynamoDB',      category: 'Cloud', status: 'healthy',  color: '#4053D6' },
];

export const findOption = (id?: string | null): DbOption =>
    DEMO_DB_OPTIONS.find((o) => o.id === id) || DEMO_DB_OPTIONS[0];

type Filter = 'All' | DbCategory | 'Healthy' | 'Issues';
const FILTERS: Filter[] = ['All', 'SQL', 'NoSQL', 'Cloud', 'Healthy', 'Issues'];

function statusColor(s: DbStatus): string {
    if (s === 'healthy')  return THEME.success;
    if (s === 'degraded') return THEME.warning;
    return THEME.danger;
}

function statusLabel(s: DbStatus): string {
    if (s === 'healthy')  return 'Healthy';
    if (s === 'degraded') return 'Degraded';
    return 'Down';
}

interface PickerProps {
    activeId: string;
    onChange: (id: string) => void;
    compareEnabled?: boolean;
    compareId?: string | null;
    onCompareToggle?: (enabled: boolean) => void;
    onCompareChange?: (id: string) => void;
}

const DemoDatabasePicker: React.FC<PickerProps> = ({
    activeId,
    onChange,
    compareEnabled = false,
    compareId,
    onCompareToggle,
    onCompareChange,
}) => {
    const active = findOption(activeId);
    const [open, setOpen] = useState(false);
    const [openCompare, setOpenCompare] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<Filter>('All');
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Close popovers on outside click
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) {
                setOpen(false);
                setOpenCompare(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return DEMO_DB_OPTIONS.filter((o) => {
            if (filter === 'SQL'     && o.category !== 'SQL')     return false;
            if (filter === 'NoSQL'   && o.category !== 'NoSQL')   return false;
            if (filter === 'Cloud'   && o.category !== 'Cloud')   return false;
            if (filter === 'Healthy' && o.status   !== 'healthy') return false;
            if (filter === 'Issues'  && o.status   === 'healthy') return false;
            if (!q) return true;
            return (
                o.label.toLowerCase().includes(q) ||
                o.vendor.toLowerCase().includes(q) ||
                o.short.toLowerCase().includes(q)
            );
        });
    }, [search, filter]);

    const renderRow = (o: DbOption, isActive: boolean, onPick: () => void) => (
        <button
            key={o.id}
            onClick={onPick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                background: isActive ? `${o.color}12` : 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: THEME.fontBody,
                transition: THEME.transitionFast,
            }}
            onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = THEME.surfaceHover;
            }}
            onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
        >
            {/* Logo bubble */}
            <div
                style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: `${o.color}18`,
                    border: `1px solid ${o.color}40`,
                    color: o.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: THEME.fontMono,
                    flexShrink: 0,
                }}
            >
                {o.short}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 12.5,
                        fontWeight: isActive ? 700 : 600,
                        color: isActive ? o.color : THEME.textMain,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2,
                    }}
                >
                    {o.label}
                </div>
                <div
                    style={{
                        fontSize: 10,
                        color: THEME.textDim,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 1,
                    }}
                >
                    {o.vendor}
                </div>
            </div>
            {/* Category chip */}
            <span
                style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 5,
                    background: THEME.surfaceHover,
                    color: THEME.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: THEME.fontMono,
                    flexShrink: 0,
                }}
            >
                {o.category}
            </span>
            {/* Status dot */}
            <span
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: statusColor(o.status),
                    boxShadow: `0 0 0 2px ${statusColor(o.status)}22`,
                    flexShrink: 0,
                    animation: o.status === 'degraded' ? 'demo-picker-pulse 1.6s ease-in-out infinite' : undefined,
                }}
                title={statusLabel(o.status)}
            />
            {isActive && <Check size={13} color={o.color} style={{ flexShrink: 0 }} />}
        </button>
    );

    const popover = (
        onPick: (id: string) => void,
        currentId: string,
        onClose: () => void,
    ) => (
        <div
            style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                background: THEME.surfaceRaised || THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 12,
                boxShadow: THEME.shadowMd,
                zIndex: 30,
                padding: 8,
                maxHeight: 420,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Search */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    background: THEME.surfaceHover,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: 8,
                    marginBottom: 6,
                }}
            >
                <Search size={12} color={THEME.textDim} />
                <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search databases…"
                    style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: THEME.textMain,
                        fontSize: 12,
                        fontFamily: THEME.fontBody,
                    }}
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: THEME.textDim,
                            display: 'flex',
                            padding: 0,
                        }}
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* Filter chips */}
            <div
                style={{
                    display: 'flex',
                    gap: 4,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                }}
            >
                {FILTERS.map((f) => {
                    const isOn = f === filter;
                    return (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                fontSize: 10,
                                fontWeight: isOn ? 700 : 600,
                                padding: '3px 8px',
                                borderRadius: 6,
                                border: `1px solid ${isOn ? THEME.primary : THEME.glassBorder}`,
                                background: isOn ? `${THEME.primary}14` : 'transparent',
                                color: isOn ? THEME.primary : THEME.textMuted,
                                cursor: 'pointer',
                                fontFamily: THEME.fontMono,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {f}
                        </button>
                    );
                })}
            </div>

            {/* Rows */}
            <div
                style={{
                    overflowY: 'auto',
                    flex: 1,
                    paddingRight: 2,
                }}
            >
                {filtered.length === 0 && (
                    <div
                        style={{
                            padding: '24px 8px',
                            textAlign: 'center',
                            color: THEME.textDim,
                            fontSize: 11.5,
                        }}
                    >
                        No databases match.
                    </div>
                )}
                {filtered.map((o) =>
                    renderRow(o, o.id === currentId, () => {
                        onPick(o.id);
                        onClose();
                    }),
                )}
            </div>
        </div>
    );

    return (
        <div ref={rootRef} style={{ position: 'relative', width: '100%' }}>
            <PickerStyles />

            {/* Primary picker button */}
            <button
                onClick={() => {
                    setOpen((v) => !v);
                    setOpenCompare(false);
                }}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    background: open ? `${active.color}10` : THEME.surfaceHover,
                    border: `1px solid ${open ? active.color : THEME.glassBorder}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: THEME.fontBody,
                    transition: THEME.transitionFast,
                    boxShadow: open ? `0 0 0 3px ${active.color}18` : 'none',
                }}
            >
                <div
                    style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: `${active.color}18`,
                        border: `1px solid ${active.color}40`,
                        color: active.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: THEME.fontMono,
                        flexShrink: 0,
                    }}
                >
                    {active.short}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div
                        style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: THEME.textMain,
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {active.label}
                    </div>
                    <div
                        style={{
                            fontSize: 9.5,
                            color: THEME.textDim,
                            fontFamily: THEME.fontMono,
                            letterSpacing: '0.04em',
                            marginTop: 1,
                        }}
                    >
                        {statusLabel(active.status)} · {active.category}
                    </div>
                </div>
                <span
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: statusColor(active.status),
                        boxShadow: `0 0 0 3px ${statusColor(active.status)}22`,
                        animation: 'demo-picker-pulse 1.6s ease-in-out infinite',
                        flexShrink: 0,
                    }}
                />
                <ChevronDown
                    size={14}
                    color={THEME.textDim}
                    style={{
                        transition: 'transform 0.2s ease',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                />
            </button>

            {open &&
                popover(
                    (id) => onChange(id),
                    activeId,
                    () => setOpen(false),
                )}

            {/* Compare toggle row */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 8,
                    padding: '0 2px',
                }}
            >
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: THEME.textMuted,
                        cursor: 'pointer',
                        fontFamily: THEME.fontBody,
                    }}
                >
                    <input
                        type="checkbox"
                        checked={compareEnabled}
                        onChange={(e) => onCompareToggle && onCompareToggle(e.target.checked)}
                        style={{ accentColor: THEME.primary, cursor: 'pointer' }}
                    />
                    <GitCompare size={11} />
                    Compare
                </label>
                <span
                    style={{
                        fontSize: 9.5,
                        color: THEME.textDim,
                        fontFamily: THEME.fontMono,
                        letterSpacing: '0.04em',
                    }}
                >
                    {DEMO_DB_OPTIONS.length} databases
                </span>
            </div>

            {/* Compare dropdown */}
            {compareEnabled && (
                <div style={{ position: 'relative', marginTop: 6 }}>
                    <button
                        onClick={() => {
                            setOpenCompare((v) => !v);
                            setOpen(false);
                        }}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            background: openCompare ? `${THEME.primary}10` : 'transparent',
                            border: `1px dashed ${THEME.glassBorder}`,
                            borderRadius: 10,
                            cursor: 'pointer',
                            fontFamily: THEME.fontBody,
                            transition: THEME.transitionFast,
                        }}
                    >
                        {compareId ? (
                            <>
                                <div
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 6,
                                        background: `${findOption(compareId).color}18`,
                                        color: findOption(compareId).color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 9,
                                        fontWeight: 800,
                                        fontFamily: THEME.fontMono,
                                    }}
                                >
                                    {findOption(compareId).short}
                                </div>
                                <span
                                    style={{
                                        flex: 1,
                                        textAlign: 'left',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: THEME.textMain,
                                    }}
                                >
                                    vs {findOption(compareId).label}
                                </span>
                            </>
                        ) : (
                            <span
                                style={{
                                    flex: 1,
                                    textAlign: 'left',
                                    fontSize: 11,
                                    color: THEME.textDim,
                                    fontFamily: THEME.fontBody,
                                }}
                            >
                                Pick a database to compare…
                            </span>
                        )}
                        <ChevronDown
                            size={12}
                            color={THEME.textDim}
                            style={{
                                transform: openCompare ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                            }}
                        />
                    </button>

                    {openCompare &&
                        popover(
                            (id) => onCompareChange && onCompareChange(id),
                            compareId || '',
                            () => setOpenCompare(false),
                        )}
                </div>
            )}
        </div>
    );
};

const PickerStyles = () => (
    <style>{`
        @keyframes demo-picker-pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.45; }
        }
    `}</style>
);

/* ─────────────────────────────────────────────────────────────────────────
   DemoOverviewSummary — the live-feel KPI strip at the top of the demo
   content. Renders 3 shared metrics + 3 DB-specific metrics for the
   currently selected database. Also supports a side-by-side comparison
   when compareOption is provided.
   ───────────────────────────────────────────────────────────────────────── */

interface DbMetric {
    label: string;
    value: string;
    sub?: string;
    trend?: string;
    trendUp?: boolean;
    spark: number[];
}
interface DbVitals {
    shared: DbMetric[];
    specific: DbMetric[];
}

/* Random-but-stable mock data per database. The numbers are illustrative —
   they look plausible and stay consistent for a given seed. */
function seededRand(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
function makeSpark(seed: number, n = 24, base = 50, span = 30): number[] {
    return Array.from({ length: n }, (_, i) => Math.round(base + seededRand(seed + i) * span));
}

export function vitalsFor(opt: DbOption): DbVitals {
    const baseSeed = opt.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const sharedSparkA = makeSpark(baseSeed,       24, 60, 35);
    const sharedSparkB = makeSpark(baseSeed + 11,  24, 90, 10);
    const sharedSparkC = makeSpark(baseSeed + 22,  24, 40, 50);
    const specA = makeSpark(baseSeed + 33,  24, 50, 40);
    const specB = makeSpark(baseSeed + 44,  24, 30, 50);
    const specC = makeSpark(baseSeed + 55,  24, 70, 25);

    const shared: DbMetric[] = [
        { label: 'Total servers', value: ['4', '6', '8', '3', '5'][baseSeed % 5], sub: 'online', trend: '+0', trendUp: true,  spark: sharedSparkA },
        { label: 'Avg uptime',    value: ['99.2%', '98.7%', '99.9%', '97.4%'][baseSeed % 4], sub: 'last 24h', trend: '+0.3%', trendUp: true, spark: sharedSparkB },
        { label: 'Net throughput', value: ['2.3 Gbps', '1.4 Gbps', '3.8 Gbps', '780 Mbps'][baseSeed % 4], sub: 'avg', trend: '-0.2 Gbps', trendUp: false, spark: sharedSparkC },
    ];

    /* Per-database "specific" KPIs — the metrics each engine cares about. */
    const specMap: Record<string, DbMetric[]> = {
        'demo-postgres': [
            { label: 'Active connections', value: '128', sub: '/ 200', trend: '+12', trendUp: true, spark: specA },
            { label: 'Cache hit ratio',    value: '98.4%', sub: 'shared_buf', trend: '+0.5%', trendUp: true, spark: specB },
            { label: 'Replication lag',    value: '42 ms', sub: 'streaming',  trend: '-8 ms',  trendUp: true, spark: specC },
        ],
        'demo-mysql': [
            { label: 'Active threads', value: '64',   sub: '/ 151',  trend: '+4',     trendUp: true,  spark: specA },
            { label: 'InnoDB buf hit', value: '97.1%', sub: 'pool',   trend: '+0.2%', trendUp: true,  spark: specB },
            { label: 'Replica lag',    value: '120 ms', sub: 'GTID',  trend: '+30 ms', trendUp: false, spark: specC },
        ],
        'demo-mongodb': [
            { label: 'Operations / s', value: '4.2k',  sub: 'mixed', trend: '+220', trendUp: true,  spark: specA },
            { label: 'Page faults / s', value: '12',    sub: 'WT',    trend: '-3',   trendUp: true,  spark: specB },
            { label: 'Replica lag',    value: '88 ms',  sub: 'oplog', trend: '+12 ms', trendUp: false, spark: specC },
        ],
        'demo-mssql': [
            { label: 'Batch req / s',  value: '1.8k', sub: 'live',     trend: '+140', trendUp: true,  spark: specA },
            { label: 'PLE',            value: '4 218', sub: 'seconds', trend: '+120', trendUp: true,  spark: specB },
            { label: 'AG sync lag',    value: '1.2 s', sub: 'sync',    trend: '+0.4 s', trendUp: false, spark: specC },
        ],
        'demo-oracle': [
            { label: 'Active sessions', value: '212', sub: 'AAS',         trend: '+8',    trendUp: true, spark: specA },
            { label: 'Buffer cache',    value: '96.8%', sub: 'hit ratio', trend: '+0.1%', trendUp: true, spark: specB },
            { label: 'Data Guard lag',  value: '2.1 s', sub: 'redo apply',trend: '-0.3 s', trendUp: true, spark: specC },
        ],
        'demo-redis': [
            { label: 'Ops / sec',     value: '184k', sub: 'cluster', trend: '+12k',   trendUp: true,  spark: specA },
            { label: 'Memory used',   value: '6.4 GB', sub: '/ 12 GB', trend: '+220 MB', trendUp: false, spark: specB },
            { label: 'Hit ratio',     value: '99.1%', sub: 'reads',  trend: '+0.2%',  trendUp: true,  spark: specC },
        ],
        'demo-elasticsearch': [
            { label: 'Indexing rate', value: '12.4k/s', sub: 'docs',  trend: '+800', trendUp: true,  spark: specA },
            { label: 'Search rate',   value: '6.1k/s',  sub: 'qps',   trend: '-120', trendUp: false, spark: specB },
            { label: 'Heap used',     value: '72%',     sub: 'JVM',   trend: '+3%',  trendUp: false, spark: specC },
        ],
        'demo-snowflake': [
            { label: 'Credits / h',   value: '14.2', sub: 'all WHs',   trend: '+1.4', trendUp: false, spark: specA },
            { label: 'Warehouses',    value: '6',    sub: 'running',   trend: '+1',   trendUp: true,  spark: specB },
            { label: 'Avg queue',     value: '1.8 s', sub: 'wait time', trend: '-0.4 s', trendUp: true, spark: specC },
        ],
        'demo-bigquery': [
            { label: 'Bytes scanned', value: '4.8 TB', sub: 'today',  trend: '+420 GB', trendUp: false, spark: specA },
            { label: 'Slot ms',       value: '92.1M',  sub: 'period', trend: '+1.2M',   trendUp: false, spark: specB },
            { label: 'Cost (est)',    value: '$184',   sub: '24h',    trend: '+$12',    trendUp: false, spark: specC },
        ],
        'demo-redshift': [
            { label: 'WLM queued',    value: '3',   sub: 'queries',   trend: '+1',  trendUp: false, spark: specA },
            { label: 'Disk used',     value: '68%', sub: 'cluster',   trend: '+2%', trendUp: false, spark: specB },
            { label: 'COPY rate',     value: '184 MB/s', sub: 'load', trend: '+12 MB', trendUp: true, spark: specC },
        ],
        'demo-cassandra': [
            { label: 'Reads / s',     value: '24.1k', sub: 'CL=LOCAL_QUORUM', trend: '+1.2k', trendUp: true, spark: specA },
            { label: 'Writes / s',    value: '9.8k',  sub: 'CL=ONE',          trend: '+400',  trendUp: true, spark: specB },
            { label: 'Hinted h.',     value: '142',   sub: 'queued',          trend: '+18',   trendUp: false, spark: specC },
        ],
        'demo-dynamodb': [
            { label: 'RCU used',      value: '3.4k', sub: '/ 5k',       trend: '+220', trendUp: false, spark: specA },
            { label: 'WCU used',      value: '1.2k', sub: '/ 2k',       trend: '+80',  trendUp: false, spark: specB },
            { label: 'Throttles',     value: '0',    sub: 'last hour',  trend: '0',    trendUp: true,  spark: specC },
        ],
    };

    return { shared, specific: specMap[opt.id] || specMap['demo-postgres'] };
}

/* Sparkline mini chart with a soft gradient fill — matches the live feel. */
const Sparkline: React.FC<{ data: number[]; color: string; w?: number; h?: number }> = ({
    data,
    color,
    w = 90,
    h = 30,
}) => {
    if (!data || data.length < 2) return <div style={{ width: w, height: h }} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
        .join(' ');
    const uid = `spk-${color.replace(/[^a-z0-9]/gi, '')}-${w}-${h}`;
    return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${uid})`} />
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

/* Single KPI card. Mirrors the look of FleetOverviewTab's metric tiles. */
const KpiTile: React.FC<{ m: DbMetric; color: string; live?: boolean }> = ({ m, color, live }) => (
    <div
        style={{
            background: THEME.surface,
            borderRadius: 16,
            border: `1px solid ${THEME.glassBorder}`,
            padding: '14px 16px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: THEME.shadowSm,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minWidth: 0,
        }}
    >
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, ${color}, ${color}66)`,
            }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: THEME.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontFamily: THEME.fontMono,
                }}
            >
                {m.label}
            </div>
            <Sparkline data={m.spark} color={color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
                style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: metricValue(color),
                    letterSpacing: '-0.02em',
                    fontFamily: THEME.fontMono,
                    lineHeight: 1,
                }}
            >
                {m.value}
            </span>
            {m.sub && (
                <span style={{ fontSize: 10.5, color: THEME.textDim }}>{m.sub}</span>
            )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {m.trend ? (
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: m.trendUp ? THEME.success : THEME.danger,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    {m.trendUp ? '↗' : '↘'} {m.trend}
                </span>
            ) : <span />}
            {live && (
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        color: THEME.success,
                        fontFamily: THEME.fontMono,
                        letterSpacing: '0.04em',
                    }}
                >
                    <span
                        style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: THEME.success,
                            animation: 'demo-picker-pulse 1.4s ease-in-out infinite',
                        }}
                    />
                    LIVE
                </span>
            )}
        </div>
    </div>
);

interface SummaryProps {
    activeId: string;
    compareId?: string | null;
}

export const DemoOverviewSummary: React.FC<SummaryProps> = ({ activeId, compareId }) => {
    const active = findOption(activeId);
    const compare = compareId ? findOption(compareId) : null;
    const a = vitalsFor(active);
    const b = compare ? vitalsFor(compare) : null;

    const Strip = ({ opt, v }: { opt: DbOption; v: DbVitals }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header row: which DB is this strip for */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    paddingBottom: 6,
                }}
            >
                <div
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 7,
                        background: `${opt.color}18`,
                        border: `1px solid ${opt.color}40`,
                        color: opt.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9.5,
                        fontWeight: 800,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    {opt.short}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>
                    {opt.label}
                </div>
                <div
                    style={{
                        fontSize: 10,
                        color: THEME.textDim,
                        fontFamily: THEME.fontMono,
                        letterSpacing: '0.04em',
                    }}
                >
                    {opt.vendor}
                </div>
                <span
                    style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: `${statusColor(opt.status)}12`,
                        border: `1px solid ${statusColor(opt.status)}30`,
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: statusColor(opt.status),
                    }}
                >
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: statusColor(opt.status),
                            animation: 'demo-picker-pulse 1.6s ease-in-out infinite',
                        }}
                    />
                    {statusLabel(opt.status)}
                </span>
            </div>

            {/* Shared KPIs (3 columns) */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                    gap: 12,
                }}
            >
                {v.shared.map((m) => (
                    <KpiTile key={m.label} m={m} color={opt.color} live />
                ))}
            </div>

            {/* Section divider for db-specific */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 4,
                }}
            >
                <div
                    style={{
                        flex: 1,
                        height: 1,
                        background: `linear-gradient(90deg, ${THEME.glassBorder}, transparent)`,
                    }}
                />
                <span
                    style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: THEME.textDim,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontFamily: THEME.fontMono,
                    }}
                >
                    {opt.label}-specific signals
                </span>
                <div
                    style={{
                        flex: 1,
                        height: 1,
                        background: `linear-gradient(270deg, ${THEME.glassBorder}, transparent)`,
                    }}
                />
            </div>

            {/* DB-specific KPIs (3 columns) */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                    gap: 12,
                }}
            >
                {v.specific.map((m) => (
                    <KpiTile key={m.label} m={m} color={opt.color} live />
                ))}
            </div>
        </div>
    );

    return (
        <div
            style={{
                background: THEME.glass,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 18,
                padding: 18,
                marginBottom: 18,
                boxShadow: THEME.shadowSm,
                backdropFilter: 'saturate(180%) blur(10px)',
            }}
        >
            {b && compare ? (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 18,
                    }}
                >
                    <Strip opt={active} v={a} />
                    <div
                        style={{
                            borderLeft: `1px dashed ${THEME.glassBorder}`,
                            paddingLeft: 18,
                        }}
                    >
                        <Strip opt={compare} v={b} />
                    </div>
                </div>
            ) : (
                <Strip opt={active} v={a} />
            )}
        </div>
    );
};

export default DemoDatabasePicker;
