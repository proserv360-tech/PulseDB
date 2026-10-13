import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import { THEME, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    CartesianGrid,
    RadialBarChart,
    RadialBar,
    PieChart,
    Pie,
    AreaChart,
    Area,
    LineChart,
    Line,
} from 'recharts';
import {
    Layers,
    RefreshCw,
    AlertTriangle,
    Database,
    Activity,
    Search,
    AlertCircle,
    Filter,
    TrendingUp,
    Zap,
    Shield,
    ChevronUp,
    ChevronDown,
    Eye,
    ArrowRight,
    Clock,
    HardDrive,
    BarChart2,
    Cpu,
    Lock,
    Users,
    BrainCircuit,
    Loader2,
    CheckCircle2,
    XCircle,
    Wifi,
    Server,
    FileText,
    Sparkles,
    MessageSquare,
    ThumbsUp,
    ThumbsDown,
    Copy,
    ChevronRight,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────
   CHART COLORS PALETTE
───────────────────────────────────────────────────────────────── */
const CHART_COLORS = [
    THEME.dangerLight,
    THEME.secondary,
    THEME.warningLight,
    THEME.aiLight,
    THEME.info,
    THEME.dangerLight,
    '#A8E063',
    THEME.dangerLight,
    THEME.infoLight,
    THEME.warningLight,
    THEME.aiLight,
    THEME.successLight,
    THEME.infoLight,
    THEME.dangerLight,
    THEME.secondary,
    THEME.ai,
];

/* ─────────────────────────────────────────────────────────────────
   CONTEXT
───────────────────────────────────────────────────────────────── */
const FilterCtx = createContext({ db: '', schema: '', table: '' });

/* ─────────────────────────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────────────────────────── */
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${THEME.textMuted}1a;border-radius: 22px}
@keyframes ud-spin  {to{transform:rotate(360deg)}}
@keyframes ud-rise  {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes ud-pulse {0%,100%{opacity:1}50%{opacity:.45}}
@keyframes ud-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes ud-typewriter{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes ai-glow{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.0)}50%{box-shadow:0 0 20px 4px rgba(139,92,246,.18)}}
.ud-rise {animation:ud-rise .3s cubic-bezier(.2,0,0,1) both}
.ud-card {
    background:${THEME.surface};
    border:1px solid ${THEME.grid};
    border-radius: 20px;
    overflow:hidden;
    box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
    backdrop-filter:blur(12px);
    transition:all 0.2s ease;
}
.ud-card:hover{box-shadow:0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);transform:translateY(-4px)}
.ud-card-header {
    height:30px;
    background:${THEME.textMain}06;
    display:flex;
    align-items:center;
    padding:14px 20px;
    gap:6px;
    border-bottom:1px solid ${THEME.glassBorder};
    font-weight:700;
}
.ud-card-dot {width:7px;height:7px;border-radius:50%}
.ud-card-title {
    font-family:'JetBrains Mono','Fira Code',monospace;
    font-size:11px;
    color:${THEME.textMuted};
    margin-left:8px;
    letter-spacing:0.03em;
}
.ud-card-body {padding:20px 24px;box-shadow:inset 0 1px 3px rgba(0,0,0,0.05)}
.ud-navitem{transition:all .15s}
.ud-navitem:hover{background:${THEME.primary}08!important}
.ud-row{transition:background .14s}
.ud-row:hover{background:${THEME.primary}04!important}
.ud-btn{transition:all .15s;cursor:pointer}
.ud-btn:hover{opacity:.85}
.ai-thinking{background:linear-gradient(90deg,${THEME.primary}10 25%,${THEME.primary}30 50%,${THEME.primary}10 75%);background-size:200% 100%;animation:ud-shimmer 1.6s ease-in-out infinite}
.ai-token{animation:ud-typewriter .15s ease both}
.ud-group-tab{
    padding:8px 16px;
    border-radius: 22px;
    border:1px solid transparent;
    cursor:pointer;
    background:transparent;
    display:inline-flex;
    align-items:center;
    gap:6px;
    font-size:12px;
    font-weight:600;
    color:${THEME.textDim};
    transition:all .2s;
    white-space:nowrap;
}
.ud-group-tab:hover{background:${THEME.primary}08;color:${THEME.textMuted}}
.ud-group-tab.active{
    background:${THEME.primary}10;
    color:${THEME.primary};
    border-color:${THEME.primary}25;
    font-weight:700;
}
.ud-sub-tab{
    padding:7px 14px;
    border-radius: 20px;
    border:none;
    cursor:pointer;
    background:transparent;
    font-size:11px;
    font-weight:500;
    color:${THEME.textDim};
    transition:all .15s;
    display:inline-flex;
    align-items:center;
    gap:5px;
}
.ud-sub-tab:hover{background:${THEME.primary}06;color:${THEME.textMuted}}
.ud-sub-tab.active{
    background:${THEME.surface};
    color:${THEME.textMain};
    font-weight:700;
    box-shadow:0 1px 4px rgba(0,0,0,0.08);
}
button{outline:none;font-family:inherit}
select,option{font-family:inherit}
`;

/* ─────────────────────────────────────────────────────────────────
   DATA HOOK
───────────────────────────────────────────────────────────────── */
const toArr = (v) => (Array.isArray(v) ? v : Array.isArray(v?.rows) ? v.rows : Array.isArray(v?.data) ? v.data : []);
const safeStr = (v) => {
    if (v === null) return '';
    if (Array.isArray(v)) return v.join(', ');
    const s = String(v);
    if (s.startsWith('{') && s.endsWith('}')) return s.slice(1, -1).replace(/"/g, '').replace(/,/g, ', ');
    return s;
};
const safeNum = (v, fb = 0) => {
    const n = Number(v);
    return isNaN(n) ? fb : n;
};

function useTableData(endpoint, fallback = []) {
    const [data, setData] = useState(fallback);
    const [loading, setLd] = useState(true);
    const [error, setErr] = useState(null);
    const load = useCallback(async () => {
        setLd(true);
        try {
            const j = await fetchData(endpoint);
            setData(Array.isArray(fallback) ? toArr(j) : (j ?? fallback));
            setErr(null);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLd(false);
        }
    }, [endpoint]);
    useEffect(() => {
        load();
    }, [load]);
    return { data, loading, error, reload: load };
}

const matchFilter = (row, f, { nk = 'name', sk = 'schema', dk = 'db' } = {}) => {
    if (f.db && row[dk] && row[dk] !== f.db) return false;
    if (f.schema && row[sk] && row[sk] !== f.schema) return false;
    if (f.table && row[nk] && row[nk] !== f.table) return false;
    return true;
};

const fmtB = (b) =>
    b >= 1073741824
        ? `${(b / 1073741824).toFixed(2)} GB`
        : b >= 1048576
          ? `${(b / 1048576).toFixed(1)} MB`
          : b >= 1024
            ? `${(b / 1024).toFixed(0)} KB`
            : `${b} B`;
const hClr = (s) => (s > 70 ? THEME.success : s > 40 ? THEME.warning : THEME.danger);
const dClr = (p) => (p > 20 ? THEME.danger : p > 10 ? THEME.warning : THEME.success);
const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);

/* ─────────────────────────────────────────────────────────────────
   SHARED ATOMS
───────────────────────────────────────────────────────────────── */
const ChartTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 20,
                padding: '20px 24px',
                fontSize: 12,
                fontFamily: THEME.fontMono,
                color: THEME.textMain,
            }}
        >
            {label && <div style={{ color: THEME.textDim, marginBottom: 4 }}>{label}</div>}
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                </div>
            ))}
        </div>
    );
};

const Bar2 = ({ v, max, color, h = 5 }) => {
    const pct = max > 0 ? Math.min(100, (v / max) * 100) : 0;
    return (
        <div style={{ width: '100%', height: h, borderRadius: h, background: `${color}18`, overflow: 'hidden' }}>
            <div
                style={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: h,
                    background: `linear-gradient(90deg,${color}aa,${color})`,
                    transition: 'width .6s cubic-bezier(.2,0,0,1)',
                }}
            />
        </div>
    );
};

const StackBar = ({ segs, h = 9 }) => (
    <div
        style={{
            display: 'flex',
            height: h,
            borderRadius: h,
            overflow: 'hidden',
            background: `${THEME.glassBorder}60`,
        }}
    >
        {segs.map((s, i) => (
            <div key={i} style={{ width: `${s.pct}%`, background: s.color, flexShrink: 0, transition: 'width .6s' }} />
        ))}
    </div>
);

const HealthRing = ({ score, size = 62 }) => {
    const color = hClr(score);
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <RadialBarChart
                width={size}
                height={size}
                cx={size / 2}
                cy={size / 2}
                innerRadius={size / 2 - 10}
                outerRadius={size / 2 - 2}
                data={[{ value: score }]}
                startAngle={90}
                endAngle={-270}
                barSize={6}
            >
                <RadialBar
                    minAngle={0}
                    background={{ fill: `${color}18` }}
                    dataKey="value"
                    cornerRadius={6}
                    fill={color}
                />
            </RadialBarChart>
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <span style={{ fontFamily: THEME.fontMono, fontWeight: 700, fontSize: 14, color }}>{score}</span>
            </div>
        </div>
    );
};

const Chip = ({ children, color, size = 'md' }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: size === 'sm' ? '2px 7px' : '3px 10px',
            borderRadius: 16,
            fontFamily: THEME.fontMono,
            fontSize: size === 'sm' ? 10 : 11,
            fontWeight: 600,
            background: `${color}1a`,
            color,
            border: `1px solid ${color}30`,
            whiteSpace: 'nowrap',
            letterSpacing: '.01em',
        }}
    >
        {children}
    </span>
);

const Card = ({ children, accent, style = {}, className = '' }) => (
    <div
        className={`ud-card ${className}`}
        style={{
            background: THEME.surface,
            ...style,
        }}
    >
        {accent && (
            <div className="ud-card-header">
                <div className="ud-card-dot" style={{ background: THEME.danger }} />
                <div className="ud-card-dot" style={{ background: THEME.warning }} />
                <div className="ud-card-dot" style={{ background: '#28c840' }} />
            </div>
        )}
        <div className={accent ? 'ud-card-body' : ''} style={accent ? {} : { padding: (style as any).padding || 0 }}>
            {children}
        </div>
    </div>
);

const SecHead = ({ Icon, title, sub, accent, right }) => {
    const ac = accent || THEME.primary;
    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: `1px solid ${THEME.glassBorder}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 20,
                        background: `${ac}10`,
                        border: `1px solid ${ac}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Icon size={15} color={ac} strokeWidth={2} />
                </div>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain, letterSpacing: '-.01em' }}>
                        {title}
                    </div>
                    {sub && <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 2 }}>{sub}</div>}
                </div>
            </div>
            {right && <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>{right}</div>}
        </div>
    );
};

const THead = ({ cols, labels }) => (
    <div
        style={{
            display: 'grid',
            gridTemplateColumns: cols,
            padding: '9px 18px',
            gap: 18,
            borderBottom: `1px solid ${THEME.glassBorder}`,
            fontSize: 10,
            fontWeight: 700,
            color: THEME.textDim,
            letterSpacing: '.08em',
            fontFamily: THEME.fontMono,
            background: `${THEME.primary}06`,
        }}
    >
        {labels.map((l) => (
            <span key={l}>{l}</span>
        ))}
    </div>
);

const TRow = ({ cols, children, i = 0 }) => (
    <div
        className="ud-row"
        style={{
            display: 'grid',
            gridTemplateColumns: cols,
            padding: '12px 18px',
            gap: 18,
            borderBottom: `1px solid ${THEME.glassBorder}50`,
            alignItems: 'center',
            background: i % 2 !== 0 ? `${THEME.glassBorder}30` : 'transparent',
        }}
    >
        {children}
    </div>
);

const Loader = () => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            gap: 20,
        }}
    >
        <div
            style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: `2px solid ${THEME.primary}30`,
                borderTopColor: THEME.primary,
                animation: 'ud-spin 1s linear infinite',
            }}
        />
        <span style={{ fontSize: 12, color: THEME.textDim, fontFamily: THEME.fontMono }}>Loading…</span>
    </div>
);

const ErrUI = ({ msg }) => (
    <div
        style={{
            padding: '20px 24px',
            borderRadius: 16,
            background: `${THEME.danger}0d`,
            border: `1px solid ${THEME.danger}25`,
            color: THEME.danger,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
        }}
    >
        <AlertCircle size={16} />
        {msg}
    </div>
);

const EmptyUI = ({ msg = 'No data matches the current filters.' }) => (
    <div style={{ padding: 48, textAlign: 'center', color: THEME.textDim }}>
        <div style={{ fontSize: 30, marginBottom: 12, opacity: 0.4 }}>⊘</div>
        <p style={{ fontSize: 13, fontFamily: THEME.fontMono }}>{msg}</p>
    </div>
);

/* ─────────────────────────────────────────────────────────────────
   FILTER SELECT
───────────────────────────────────────────────────────────────── */
const FilterSelect = React.memo(function FilterSelect({ label, filterKey, val, opts, ph, onUpd }) {
    const active = !!val;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 150 }}>
            <label
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: THEME.textDim,
                    letterSpacing: '.07em',
                    fontFamily: THEME.fontMono,
                }}
            >
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <select
                    value={val}
                    onChange={(e) => onUpd(filterKey, e.target.value)}
                    disabled={opts.length === 0}
                    style={{
                        width: '100%',
                        padding: '9px 32px 9px 12px',
                        borderRadius: 20,
                        border: `1px solid ${active ? THEME.primary + '55' : THEME.glassBorder}`,
                        background: active ? `${THEME.primary}0c` : THEME.surface,
                        color: active ? THEME.textMain : THEME.textMuted,
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        appearance: 'none',
                        cursor: opts.length === 0 ? 'not-allowed' : 'pointer',
                        outline: 'none',
                        transition: 'border-color .2s, background .2s',
                    }}
                >
                    <option value="">{ph}</option>
                    {opts.map((o) => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    size={12}
                    color={THEME.textDim}
                    style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                    }}
                />
            </div>
        </div>
    );
});

/* ─────────────────────────────────────────────────────────────────
   FILTER BAR
───────────────────────────────────────────────────────────────── */
const FilterBar = React.memo(function FilterBar({ filter, setFilter, allTables, dbRaw }) {
    const tables = allTables || [];
    const dbs = useMemo(() => {
        const a = toArr(dbRaw)
            .map((d) => d.name || d)
            .filter(Boolean);
        return a.length ? [...new Set(a)].sort() : [...new Set(tables.map((t) => t.db).filter(Boolean))].sort();
    }, [dbRaw, tables]);
    const schemas = useMemo(
        () =>
            [
                ...new Set(
                    tables
                        .filter((t) => !filter.db || t.db === filter.db)
                        .map((t) => t.schema)
                        .filter(Boolean),
                ),
            ].sort(),
        [tables, filter.db],
    );
    const tableList = useMemo(
        () =>
            [
                ...new Set(
                    tables
                        .filter((t) => !filter.db || t.db === filter.db)
                        .filter((t) => !filter.schema || t.schema === filter.schema)
                        .map((t) => t.name)
                        .filter(Boolean),
                ),
            ].sort(),
        [tables, filter.db, filter.schema],
    );
    const upd = useCallback(
        (k, v) => {
            if (k === 'db') setFilter({ db: v, schema: '', table: '' });
            else if (k === 'schema') setFilter((f) => ({ ...f, schema: v, table: '' }));
            else setFilter((f) => ({ ...f, table: v }));
        },
        [setFilter],
    );
    const hasFilter = filter.db || filter.schema || filter.table;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 18,
                padding: '22px 28px',
                display: 'flex',
                gap: 22,
                alignItems: 'flex-end',
                flexWrap: 'wrap',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 2 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 20,
                        background: `${THEME.cyan}12`,
                        border: `1px solid ${THEME.cyan}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Filter size={15} color={THEME.cyan} />
                </div>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>Filters</div>
                    <div style={{ fontSize: 11, color: THEME.textDim }}>
                        {hasFilter
                            ? `${[filter.db, filter.schema, filter.table].filter(Boolean).length} active`
                            : 'Showing all'}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 18, flex: 1, flexWrap: 'wrap' }}>
                {dbs.length > 0 && (
                    <FilterSelect
                        label="Database"
                        filterKey="db"
                        val={filter.db}
                        opts={dbs}
                        ph="All databases"
                        onUpd={upd}
                    />
                )}
                <FilterSelect
                    label="Schema"
                    filterKey="schema"
                    val={filter.schema}
                    opts={schemas}
                    ph="All schemas"
                    onUpd={upd}
                />
                <FilterSelect
                    label="Table"
                    filterKey="table"
                    val={filter.table}
                    opts={tableList}
                    ph="All tables"
                    onUpd={upd}
                />
            </div>
            {hasFilter && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, paddingBottom: 2 }}>
                    <div
                        style={{
                            padding: '20px 24px',
                            borderRadius: 20,
                            background: `${THEME.primary}10`,
                            border: `1px solid ${THEME.primary}25`,
                            fontSize: 12,
                            color: THEME.primary,
                            fontFamily: THEME.fontMono,
                            fontWeight: 600,
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        {[filter.db, filter.schema, filter.table].filter(Boolean).join(' › ')}
                    </div>
                    <button
                        className="ud-btn"
                        onClick={() => setFilter({ db: '', schema: '', table: '' })}
                        style={{
                            padding: '20px 24px',
                            borderRadius: 20,
                            border: `1px solid ${THEME.glassBorder}`,
                            background: 'transparent',
                            color: THEME.textDim,
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                        }}
                    >
                        ✕ Clear
                    </button>
                </div>
            )}
        </div>
    );
});

/* ─────────────────────────────────────────────────────────────────
   ORIGINAL SECTIONS (kept intact)
───────────────────────────────────────────────────────────────── */
function S_Health() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/stats');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = data.filter((t) => matchFilter(t, f));
    if (!rows.length) return <EmptyUI />;
    const chartData = rows
        .slice(0, 8)
        .map((t) => ({
            name: t.name,
            dead: Number(t.deadPct),
            health: Math.max(0, Math.round(100 - Number(t.deadPct) * 2)),
        }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Activity}
                accent={THEME.success}
                title="Health Scorecard"
                sub="Per-table health score, dead tuple ratio, and VACUUM recommendations"
                right={<Chip color={THEME.cyan}>{rows.length} tables</Chip>}
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: THEME.textDim,
                        letterSpacing: '.07em',
                        marginBottom: 12,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    Dead Tuple % Overview
                </div>
                <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={chartData} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="dead" name="Dead %" radius={[4, 4, 0, 0]}>
                            {chartData.map((d, i) => (
                                <Cell key={i} fill={dClr(d.dead)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 20 }}>
                {rows.map((t, i) => {
                    const dead = Number(t.deadPct);
                    const health = Math.max(0, Math.round(100 - dead * 2));
                    const color = hClr(health);
                    const rec = dead > 20 ? 'VACUUM urgently' : dead > 10 ? 'VACUUM soon' : 'Healthy';
                    return (
                        <Card
                            key={i}
                            accent={color}
                            style={{ padding: 18, animationDelay: `${i * 40}ms` }}
                            className="ud-rise"
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: 14,
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontWeight: 700,
                                            fontSize: 14,
                                            color: THEME.textMain,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {t.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: THEME.textDim,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 2,
                                        }}
                                    >
                                        {t.schema}
                                    </div>
                                </div>
                                <HealthRing score={health} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, color: THEME.textDim }}>Dead tuples</span>
                                <span
                                    style={{
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                        color: dClr(dead),
                                        fontWeight: 600,
                                    }}
                                >
                                    {dead}%
                                </span>
                            </div>
                            <Bar2 v={dead} max={50} color={dClr(dead)} h={4} />
                            <div
                                style={{
                                    marginTop: 12,
                                    padding: '5px 10px',
                                    borderRadius: 18,
                                    background: `${color}0f`,
                                    border: `1px solid ${color}20`,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color,
                                }}
                            >
                                → {rec}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function S_Activity() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/stats');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = data.filter((t) => matchFilter(t, f));
    if (!rows.length) return <EmptyUI />;
    const chartData = rows
        .slice(0, 8)
        .map((t) => ({
            name: t.name,
            seqScans: Number(t.seqScans),
            idxScans: Number(t.idxScans),
            inserts: Number(t.inserts),
        }));
    const metrics = [
        { key: 'seqScans', label: 'Seq Scans', color: THEME.danger },
        { key: 'idxScans', label: 'Idx Scans', color: THEME.success },
        { key: 'inserts', label: 'Inserts', color: THEME.primary },
    ];
    const maxes = {
        seqScans: rows.length > 0 ? Math.max(...rows.map((t) => Number(t.seqScans))) : 1,
        idxScans: rows.length > 0 ? Math.max(...rows.map((t) => Number(t.idxScans))) : 1,
        inserts: rows.length > 0 ? Math.max(...rows.map((t) => Number(t.inserts))) : 1,
    };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={BarChart2}
                accent={THEME.warning}
                title="Activity Heatmap"
                sub="Sequential vs. index scans and DML rates per table"
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData} barCategoryGap="30%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={32}
                        />
                        <Tooltip content={<ChartTip />} />
                        {metrics.map((m) => (
                            <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} radius={[3, 3, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 22, justifyContent: 'center', paddingTop: 6 }}>
                    {metrics.map((m) => (
                        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                            <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                {m.label}
                            </span>
                        </div>
                    ))}
                </div>
            </Card>
            <Card>
                <THead cols="160px repeat(3,1fr)" labels={['Table', ...metrics.map((m) => m.label)]} />
                {rows.map((t, i) => (
                    <TRow key={i} cols="160px repeat(3,1fr)" i={i}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textMain }}>{t.name}</div>
                            <div
                                style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono, marginTop: 2 }}
                            >
                                {t.schema}
                            </div>
                        </div>
                        {metrics.map((m) => {
                            const val = Number(t[m.key]);
                            const pct = Math.min(100, (val / maxes[m.key]) * 100);
                            return (
                                <div key={m.key}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <span
                                            style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textMuted }}
                                        >
                                            {val.toLocaleString()}
                                        </span>
                                        <span
                                            style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.textDim }}
                                        >
                                            {pct.toFixed(0)}%
                                        </span>
                                    </div>
                                    <Bar2 v={val} max={maxes[m.key]} color={m.color} h={4} />
                                </div>
                            );
                        })}
                    </TRow>
                ))}
            </Card>
        </div>
    );
}

function S_Forecast() {
    const f = useContext(FilterCtx);
    const { data, loading } = useTableData('/api/tables/stats');
    if (loading) return <Loader />;
    const rows = data.filter((t) => matchFilter(t, f)).slice(0, f.table ? 1 : 6);
    if (!rows.length) return <EmptyUI />;
    const chartData = rows.map((t) => ({ name: t.name, dead: Number(t.deadPct), threshold: 20 }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={TrendingUp}
                accent={THEME.danger}
                title="Dead Tuple Forecast"
                sub="Predicted autovacuum threshold hits based on current dead tuple accumulation"
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} barCategoryGap="32%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="dead" name="Dead %" radius={[4, 4, 0, 0]}>
                            {chartData.map((d, i) => (
                                <Cell key={i} fill={dClr(d.dead)} />
                            ))}
                        </Bar>
                        <Bar dataKey="threshold" name="Threshold" fill={`${THEME.warning}40`} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
                {rows.map((r, i) => {
                    const dead = Number(r.deadPct);
                    const risk = dead > 20 ? 'Critical' : dead > 10 ? 'High' : 'Normal';
                    const c = dead > 20 ? THEME.danger : dead > 10 ? THEME.warning : THEME.success;
                    const est = dead > 20 ? '< 3 days' : dead > 10 ? '~1 week' : '> 30 days';
                    return (
                        <Card key={i} style={{ padding: 18 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: THEME.textMain }}>{r.name}</div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 2,
                                        }}
                                    >
                                        {r.schema}
                                    </div>
                                </div>
                                <Chip color={c}>{risk}</Chip>
                            </div>
                            <Bar2 v={dead} max={50} color={c} h={7} />
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 5,
                                    fontSize: 10,
                                    color: THEME.textDim,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                <span>0%</span>
                                <span style={{ color: THEME.warning }}>20% threshold</span>
                                <span>50%</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 14,
                                    padding: '22px 28px',
                                    borderRadius: 20,
                                    background: `${THEME.glassBorder}40`,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontFamily: THEME.fontMono,
                                            letterSpacing: '.05em',
                                        }}
                                    >
                                        Current
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 18,
                                            fontWeight: 700,
                                            color: metricValue(c),
                                            fontFamily: THEME.fontMono,
                                            marginTop: 2,
                                        }}
                                    >
                                        {dead}%
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontFamily: THEME.fontMono,
                                            letterSpacing: '.05em',
                                        }}
                                    >
                                        VACUUM est.
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: THEME.textMuted,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 2,
                                        }}
                                    >
                                        {est}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function S_RowCounts() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/stats');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = data.filter((t) => matchFilter(t, f));
    if (!rows.length) return <EmptyUI />;
    const maxLive = rows.length > 0 ? Math.max(...rows.map((t) => Number(t.liveRows ?? t.rows ?? 0))) : 1;
    const chartData = rows
        .slice(0, 8)
        .map((t) => ({ name: t.name, live: Number(t.liveRows ?? t.rows ?? 0), dead: Number(t.deadRows ?? 0) }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Database}
                accent={THEME.primary}
                title="Row Count Snapshot"
                sub="Live vs. dead tuple counts from pg_stat_user_tables"
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} barCategoryGap="30%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="live" name="Live Rows" fill={THEME.success} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="dead" name="Dead Rows" fill={THEME.danger} radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <Card>
                <THead cols="1.5fr 1.8fr 1fr 1fr" labels={['Table', 'Live Rows', 'Dead Rows', 'Dead Ratio']} />
                {rows.map((t, i) => {
                    const live = Number(t.liveRows ?? t.rows ?? 0);
                    const dead = Number(t.deadRows ?? 0);
                    const ratio = live + dead > 0 ? ((dead / (live + dead)) * 100).toFixed(1) : '0.0';
                    const rc = dClr(Number(ratio));
                    return (
                        <TRow key={i} cols="1.5fr 1.8fr 1fr 1fr" i={i}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textMain }}>{t.name}</div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textDim,
                                        fontFamily: THEME.fontMono,
                                        marginTop: 2,
                                    }}
                                >
                                    {t.schema}
                                </div>
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                        color: THEME.success,
                                        marginBottom: 5,
                                    }}
                                >
                                    {live.toLocaleString()}
                                </div>
                                <Bar2 v={live} max={maxLive} color={THEME.success} h={4} />
                            </div>
                            <span
                                style={{
                                    fontFamily: THEME.fontMono,
                                    fontSize: 12,
                                    color: dead > 0 ? THEME.danger : THEME.textDim,
                                }}
                            >
                                {dead.toLocaleString()}
                            </span>
                            <Chip color={rc} size="sm">
                                {ratio}%
                            </Chip>
                        </TRow>
                    );
                })}
            </Card>
        </div>
    );
}

function pgArrayToString(val) {
    if (val === null) return '—';
    if (Array.isArray(val)) return val.join(', ') || '—';
    const s = String(val);
    if (s.startsWith('{') && s.endsWith('}')) return s.slice(1, -1).replace(/"/g, '').replace(/,/g, ', ') || '—';
    return s || '—';
}

function S_Columns() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/columns');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const normalized = data.map((col) => ({
        ...col,
        tablename: col.tablename || col.table_name || col.table || '',
        schema: col.schema || col.table_schema || '',
        name: col.name || col.column_name || col.attname || '',
        nullPct: safeNum((col.nullPct ?? col.null_pct ?? col.null_frac !== null) ? safeNum(col.null_frac) * 100 : 0),
        distinct: safeNum(col.distinct ?? col.n_distinct ?? col.distinct_count),
        topValues: pgArrayToString(col.topValues ?? col.top_values ?? col.most_common_vals),
        dataType: col.dataType || col.data_type || col.typname || '',
    }));
    const rows = normalized.filter((col) => {
        const tn = col.tablename || '';
        const cs = col.schema || (tn.includes('.') ? tn.split('.')[0] : null);
        const ct = tn.includes('.') ? tn.split('.')[1] : tn;
        if (f.schema && cs && cs !== f.schema) return false;
        if (f.table && ct && ct !== f.table) return false;
        return true;
    });
    if (!rows.length) return <EmptyUI />;
    const nullDist = [
        { name: '0%', value: rows.filter((c) => c.nullPct === 0).length },
        { name: '1–5%', value: rows.filter((c) => c.nullPct > 0 && c.nullPct <= 5).length },
        { name: '5–20%', value: rows.filter((c) => c.nullPct > 5 && c.nullPct <= 20).length },
        { name: '>20%', value: rows.filter((c) => c.nullPct > 20).length },
    ];
    const PIE_COLORS = [THEME.success, THEME.primary, THEME.warning, THEME.danger];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Search}
                accent={THEME.purple}
                title="Column Stats Explorer"
                sub="Null percentage, distinct counts, and most common values"
                right={<Chip color={THEME.purple}>{rows.length} columns</Chip>}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                <Card
                    style={{
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 22,
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: THEME.textDim,
                            letterSpacing: '.07em',
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        Null Distribution
                    </div>
                    <PieChart width={140} height={140}>
                        <Pie
                            data={nullDist}
                            cx={65}
                            cy={65}
                            innerRadius={38}
                            outerRadius={60}
                            dataKey="value"
                            paddingAngle={3}
                        >
                            {nullDist.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i]} />
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTip />} />
                    </PieChart>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center' }}>
                        {nullDist.map((d, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i] }} />
                                <span style={{ fontSize: 10, color: THEME.textDim }}>
                                    {d.name} ({d.value})
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
                <Card style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'auto' }}>
                    <div style={{ minWidth: 580 }}>
                        <THead
                            cols="1.2fr 1.4fr 1fr 1fr 2fr"
                            labels={['Table', 'Column', 'Null %', 'Distinct', 'Top Values']}
                        />
                        {rows.map((col, i) => {
                            const np = col.nullPct.toFixed(1);
                            const nc =
                                col.nullPct > 20 ? THEME.danger : col.nullPct > 5 ? THEME.warning : THEME.success;
                            return (
                                <TRow key={i} cols="1.2fr 1.4fr 1fr 1fr 2fr" i={i}>
                                    <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                        {col.tablename}
                                    </span>
                                    <span
                                        style={{
                                            fontFamily: THEME.fontMono,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: THEME.primary,
                                        }}
                                    >
                                        {col.name}
                                    </span>
                                    <div>
                                        <div
                                            style={{
                                                fontFamily: THEME.fontMono,
                                                fontSize: 10,
                                                color: nc,
                                                fontWeight: 600,
                                                marginBottom: 4,
                                            }}
                                        >
                                            {np}%
                                        </div>
                                        <Bar2 v={col.nullPct} max={100} color={nc} h={3} />
                                    </div>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.textMuted }}>
                                        {col.distinct.toLocaleString()}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                        title={col.topValues}
                                    >
                                        {col.topValues}
                                    </span>
                                </TRow>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function S_Toast() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/toast');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = f.table
        ? data.filter((t) => t.table === f.table)
        : data.filter((t) => matchFilter(t, f, { nk: 'table' }));
    if (!rows.length) return <EmptyUI msg="No TOAST data for the selected table." />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Layers}
                accent={THEME.warning}
                title="TOAST Table Bloat"
                sub="Oversized column TOAST storage and dead chunk percentages"
            />
            <Card>
                <THead cols="1.5fr 1fr 1.5fr" labels={['Main Table', 'TOAST Size', 'Dead Chunk %']} />
                {rows.map((t, i) => {
                    const dead = Number(t.deadPct);
                    const c = dead > 20 ? THEME.danger : dead > 5 ? THEME.warning : THEME.success;
                    return (
                        <TRow key={i} cols="1.5fr 1fr 1.5fr" i={i}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textMain }}>{t.table}</div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textDim,
                                        fontFamily: THEME.fontMono,
                                        marginTop: 2,
                                    }}
                                >
                                    {t.toastTable}
                                </div>
                            </div>
                            <span
                                style={{ fontFamily: THEME.fontMono, fontSize: 13, fontWeight: 600, color: THEME.cyan }}
                            >
                                {t.toastSize}
                            </span>
                            <div>
                                <div
                                    style={{
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                        color: c,
                                        fontWeight: 600,
                                        marginBottom: 5,
                                    }}
                                >
                                    {dead}%
                                </div>
                                <Bar2 v={dead} max={40} color={c} h={4} />
                            </div>
                        </TRow>
                    );
                })}
            </Card>
        </div>
    );
}

function S_Temp() {
    const { data, loading, error } = useTableData('/api/tables/temp');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Clock}
                accent={THEME.cyan}
                title="Temp Table Usage"
                sub="Temporary table sizes and session ages from pg_temp"
            />
            <Card>
                <THead cols="1.5fr 1fr 1fr 1fr" labels={['App / User', 'PID', 'Temp Size', 'Session Age']} />
                {data.length === 0 ? (
                    <div style={{ padding: 36, textAlign: 'center', color: THEME.textDim, fontSize: 13 }}>
                        No active temp tables.
                    </div>
                ) : (
                    data.map((t, i) => (
                        <TRow key={i} cols="1.5fr 1fr 1fr 1fr" i={i}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textMain }}>
                                    {t.app || 'Unknown'}
                                </div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textDim,
                                        fontFamily: THEME.fontMono,
                                        marginTop: 2,
                                    }}
                                >
                                    {t.user}
                                </div>
                            </div>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.textMuted }}>
                                {t.pid}
                            </span>
                            <span
                                style={{
                                    fontFamily: THEME.fontMono,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: THEME.warning,
                                }}
                            >
                                {t.size}
                            </span>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.textDim }}>
                                {t.age_sec}s
                            </span>
                        </TRow>
                    ))
                )}
            </Card>
        </div>
    );
}

function S_Schema() {
    const f = useContext(FilterCtx);
    const { data: events, loading } = useTableData('/api/schema/ddl-history', []);
    const rows = (Array.isArray(events) ? events : []).filter(
        (e) => (!f.schema || e.schema === f.schema) && (!f.table || e.obj === f.table),
    );
    if (loading) return <Loader />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={HardDrive}
                accent={THEME.purple}
                title="Schema Change History"
                sub="DDL audit log — requires pgAudit extension for live tracking"
            />
            {!rows.length ? (
                <EmptyUI msg="No DDL events for the selected scope." />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    {rows.map((e, i) => {
                        const tc =
                            e.risk === 'high' ? THEME.danger : e.risk === 'medium' ? THEME.warning : THEME.success;
                        return (
                            <Card key={i} style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex' }}>
                                    <div style={{ width: 3, background: tc, flexShrink: 0 }} />
                                    <div style={{ padding: '20px 24px', flex: 1 }}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                gap: 22,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                                                <Chip color={tc} size="sm">
                                                    {e.type}
                                                </Chip>
                                                <span
                                                    style={{
                                                        fontFamily: THEME.fontMono,
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color: THEME.textMain,
                                                    }}
                                                >
                                                    {e.schema}.{e.obj}
                                                </span>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: 11,
                                                    color: THEME.textDim,
                                                    fontFamily: THEME.fontMono,
                                                }}
                                            >
                                                {e.ts}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 12, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                            {e.detail}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function toSafeArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    const s = String(v).trim();
    if (s.startsWith('{') && s.endsWith('}'))
        return s
            .slice(1, -1)
            .split(',')
            .map((x) => x.trim().replace(/"/g, ''))
            .filter(Boolean);
    if (s.includes(','))
        return s
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
    return s ? [s] : [];
}

function S_Deps() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/dependencies');
    const [selected, setSelected] = useState(null);
    const [hovered, setHovered] = useState(null);
    const [viewMode, setViewMode] = useState('map');

    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;

    const normalized = data.map((t) => ({ ...t, refsTo: toSafeArr(t.refsTo), refsBy: toSafeArr(t.refsBy) }));
    const rows = f.table
        ? normalized.filter((t) => t.name === f.table || t.refsTo.includes(f.table) || t.refsBy.includes(f.table))
        : normalized.filter((t) => matchFilter(t, f));
    if (!rows.length) return <EmptyUI />;

    const focusName = f.table || selected;
    const focusRow = focusName ? normalized.find((r) => r.name === focusName) || null : null;

    const W = 980,
        H = 560,
        cx = W / 2,
        cy = H / 2;

    const sn = (s, n = 14) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

    /* Smooth cubic-bezier branch — horizontal tension */
    const makeBranch = (x1, y1, x2, y2, bend = 0.44) => {
        const dx = x2 - x1;
        return `M ${x1} ${y1} C ${x1 + dx * bend} ${y1}, ${x2 - dx * bend} ${y2}, ${x2} ${y2}`;
    };

    /* Quadratic bezier for thinner sub-branches */
    const makeSubBranch = (x1, y1, x2, y2) => {
        const mx = (x1 + x2) / 2,
            my = Math.min(y1, y2) - 22;
        return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
    };

    /* ── Pill node (rounded rectangle label bubble) ─────── */
    const PillNode = ({ x, y, label, color, size = 'md', onClick }) => {
        const fs = size === 'sm' ? 8 : size === 'lg' ? 12 : 9.5;
        const ph = size === 'sm' ? 20 : size === 'lg' ? 32 : 26;
        const pw = Math.max(60, label.length * (size === 'lg' ? 7 : 5.8) + 26);
        const lit = hovered === label;
        return (
            <g
                onClick={onClick}
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: onClick ? 'pointer' : 'default' }}
            >
                {/* Hover glow ring */}
                {lit && onClick && (
                    <rect
                        x={x - pw / 2 - 6}
                        y={y - ph / 2 - 6}
                        width={pw + 12}
                        height={ph + 12}
                        rx={(ph + 12) / 2}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.2}
                        strokeOpacity={0.35}
                        strokeDasharray="4 3"
                    />
                )}
                {/* Pill body */}
                <rect
                    x={x - pw / 2}
                    y={y - ph / 2}
                    width={pw}
                    height={ph}
                    rx={ph / 2}
                    fill={lit ? `${color}28` : `${color}14`}
                    stroke={color}
                    strokeWidth={lit ? 2.2 : 1.5}
                    strokeOpacity={lit ? 1 : 0.85}
                    style={{ transition: 'all 0.15s' }}
                />
                {/* Label */}
                <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fs}
                    fontWeight={lit ? 800 : 700}
                    fill={lit ? color : `${color}cc`}
                    fontFamily="'Fira Code',monospace"
                    style={{ userSelect: 'none', transition: 'all 0.15s' }}
                >
                    {label}
                </text>
                {/* Click-to-explore arrow on hover */}
                {lit && onClick && (
                    <text
                        x={x + pw / 2 - 8}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={8}
                        fill={color}
                        fillOpacity={0.7}
                        fontFamily="sans-serif"
                        style={{ userSelect: 'none' }}
                    >
                        ›
                    </text>
                )}
            </g>
        );
    };

    /* ── Inline SVG floating tooltip — compact elegant card ── */

    const FocusedView = () => {
        const deps = focusRow.refsTo;
        const refs = focusRow.refsBy;

        const cRx = Math.max(72, sn(focusRow.name, 20).length * 5.8 + 18);
        const cRy = 38;

        /* Main nodes: positioned comfortably away from both center and edge */
        const MAIN_INSET = 230; // x distance from SVG edge for main pills
        const SUB_INSET = 88; // x distance from SVG edge for sub-branch pills

        const layoutSide = (items, side) => {
            const N = items.length;
            if (!N) return [];
            /* Vertical spread — cap so nodes don't overflow top/bottom */
            const maxSpread = H - 100;
            const spread = Math.min(N * 68, maxSpread);
            const ex = side === 'left' ? MAIN_INSET : W - MAIN_INSET;
            return items.map((name, i) => ({
                name,
                side,
                x: ex,
                y: N === 1 ? cy : cy - spread / 2 + (spread / (N - 1)) * i,
                color: CHART_COLORS[(side === 'left' ? i : i + 8) % CHART_COLORS.length],
            }));
        };

        const depNodes = layoutSide(deps, 'left');
        const refNodes = layoutSide(refs, 'right');

        /* Gather up to 3 second-level connections per node */
        const getSubs = (name, side) => {
            const rel = normalized.find((r) => r.name === name);
            if (!rel) return [];
            return (side === 'left' ? rel.refsTo : rel.refsBy).filter((s) => s !== focusRow.name).slice(0, 3);
        };

        const renderSide = (nodes, side) =>
            nodes.map((node) => {
                const lit = hovered === node.name;
                const pillW = Math.max(64, sn(node.name).length * 5.6 + 24);
                const pillH = 26;
                /* Branch from center ellipse edge → pill near-edge */
                const fromX = side === 'left' ? cx - cRx : cx + cRx;
                const toX = side === 'left' ? node.x + pillW / 2 : node.x - pillW / 2;
                const d = makeBranch(fromX, cy, toX, node.y);
                const subs = getSubs(node.name, side);
                /* Sub-branches fan VERTICALLY beside main pill, not outward */
                const subSpread = Math.min(subs.length * 30, 80);
                return (
                    <g key={node.name}>
                        {/* Main branch curve */}
                        <path
                            d={d}
                            fill="none"
                            stroke={node.color}
                            strokeWidth={lit ? 3.5 : 2.5}
                            strokeOpacity={lit ? 0.92 : 0.58}
                            strokeLinecap="round"
                            style={{ transition: 'all 0.18s' }}
                        />

                        {/* Main pill */}
                        <PillNode
                            x={node.x}
                            y={node.y}
                            label={sn(node.name)}
                            color={node.color}
                            onClick={() => setSelected(node.name)}
                        />

                        {/* Level-2: small pills fanning vertically at the outer edge */}
                        {subs.map((sub, si) => {
                            const N = subs.length;
                            /* Fan above/below the main node */
                            const subY = node.y + (N === 1 ? 0 : -subSpread / 2 + (subSpread / (N - 1)) * si);
                            /* Anchor x just inside SVG edge */
                            const subX = side === 'left' ? SUB_INSET : W - SUB_INSET;
                            const spw = Math.max(52, sn(sub, 10).length * 4.8 + 16);
                            /* Connect from pill outer edge to sub pill */
                            const sx1 = side === 'left' ? node.x - pillW / 2 : node.x + pillW / 2;
                            const sx2 = side === 'left' ? subX + spw / 2 : subX - spw / 2;
                            const smx = (sx1 + sx2) / 2;
                            const smy = (node.y + subY) / 2 - 12;
                            const sd = `M ${sx1} ${node.y} Q ${smx} ${smy} ${sx2} ${subY}`;
                            return (
                                <g key={sub}>
                                    <path
                                        d={sd}
                                        fill="none"
                                        stroke={node.color}
                                        strokeWidth={1.1}
                                        strokeOpacity={0.35}
                                        strokeDasharray="4 3"
                                    />
                                    <rect
                                        x={subX - spw / 2}
                                        y={subY - 10}
                                        width={spw}
                                        height={20}
                                        rx={10}
                                        fill={`${node.color}0e`}
                                        stroke={node.color}
                                        strokeWidth={0.9}
                                        strokeOpacity={0.45}
                                    />
                                    <text
                                        x={subX}
                                        y={subY}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={7.5}
                                        fill={node.color}
                                        opacity={0.78}
                                        fontFamily="'Fira Code',monospace"
                                    >
                                        {sn(sub, 10)}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                );
            });

        return (
            <g>
                {/* Section banners — aligned over each group of nodes */}
                {deps.length > 0 && (
                    <text
                        x={MAIN_INSET}
                        y={22}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={800}
                        letterSpacing="0.02em"
                        fill={CHART_COLORS[0]}
                        fontFamily="'Fira Code',monospace"
                        opacity={0.8}
                    >
                        ◀ DEPENDS ON
                    </text>
                )}
                {refs.length > 0 && (
                    <text
                        x={W - MAIN_INSET}
                        y={22}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={800}
                        letterSpacing="0.02em"
                        fill={CHART_COLORS[1]}
                        fontFamily="'Fira Code',monospace"
                        opacity={0.8}
                    >
                        REFERENCED BY ▶
                    </text>
                )}

                {renderSide(depNodes, 'left')}
                {renderSide(refNodes, 'right')}

                {/* ── Premium Center Hub ── */}
                <g onClick={() => setSelected(null)} style={{ cursor: 'pointer' }}>
                    {/* Outermost soft halo */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={cRx + 38}
                        ry={cRy + 38}
                        fill="none"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={1}
                        strokeOpacity={0.08}
                        filter="url(#mm-glow)"
                        style={{ animation: 'ud-pulse 4s ease-in-out infinite' }}
                    />
                    {/* Orbit ring with dashes */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={cRx + 26}
                        ry={cRy + 26}
                        fill="none"
                        stroke="url(#rim-grad)"
                        strokeWidth={0.8}
                        strokeDasharray="6 4"
                        strokeOpacity={0.4}
                    />
                    {/* Mid glow ring */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={cRx + 14}
                        ry={cRy + 14}
                        fill={`${CHART_COLORS[1]}08`}
                        stroke={CHART_COLORS[1]}
                        strokeWidth={0.5}
                        strokeOpacity={0.18}
                    />
                    {/* Main body */}
                    <ellipse cx={cx} cy={cy} rx={cRx} ry={cRy} fill="url(#hub-grad-focus)" />
                    {/* Sheen highlight — top-left gloss */}
                    <ellipse
                        cx={cx - cRx * 0.22}
                        cy={cy - cRy * 0.28}
                        rx={cRx * 0.52}
                        ry={cRy * 0.32}
                        fill="white"
                        fillOpacity={0.045}
                    />
                    {/* Crisp rim stroke */}
                    <ellipse cx={cx} cy={cy} rx={cRx} ry={cRy} fill="none" stroke="url(#rim-grad)" strokeWidth={2} />
                    {/* Inner rim hairline */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={cRx - 3}
                        ry={cRy - 3}
                        fill="none"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={0.4}
                        strokeOpacity={0.2}
                    />

                    {/* Table name */}
                    <text
                        x={cx}
                        y={cy - 7}
                        textAnchor="middle"
                        fontSize={11.5}
                        fontWeight={800}
                        fill={THEME.textMain}
                        fontFamily="'Plus Jakarta Sans',sans-serif"
                        letterSpacing="0.02em"
                        style={{ userSelect: 'none' }}
                    >
                        {sn(focusRow.name, 18)}
                    </text>
                    {/* Subtitle: FK stats */}
                    <text
                        x={cx}
                        y={cy + 10}
                        textAnchor="middle"
                        fontSize={8}
                        fontWeight={500}
                        fill={CHART_COLORS[1]}
                        fontFamily="'Fira Code',monospace"
                        fillOpacity={0.75}
                        style={{ userSelect: 'none' }}
                    >
                        {focusRow.refsTo.length} deps · {focusRow.refsBy.length} refs
                    </text>

                    {/* Tiny orbit dots at 3 cardinal positions */}
                    {[0, 120, 240].map((deg, i) => {
                        const rad = (deg * Math.PI) / 180;
                        const dx = (cRx + 26) * Math.cos(rad);
                        const dy = (cRy + 26) * Math.sin(rad);
                        return (
                            <circle
                                key={i}
                                cx={cx + dx}
                                cy={cy + dy}
                                r={2.8}
                                fill={[CHART_COLORS[1], CHART_COLORS[0], CHART_COLORS[2]][i]}
                                fillOpacity={0.7}
                            />
                        );
                    })}

                    {/* Critical badge */}
                    {focusRow.refsBy.length > 2 && (
                        <g filter="url(#mm-glow-sm)">
                            <circle cx={cx + cRx + 2} cy={cy - cRy + 2} r={11} fill={THEME.danger} />
                            <circle
                                cx={cx + cRx + 2}
                                cy={cy - cRy + 2}
                                r={11}
                                fill="none"
                                stroke={THEME.textMain}
                                strokeWidth={1.2}
                                strokeOpacity={0.3}
                            />
                            <text
                                x={cx + cRx + 2}
                                y={cy - cRy + 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize={8.5}
                                fontWeight={900}
                                fill={THEME.textMain}
                                fontFamily="sans-serif"
                            >
                                !
                            </text>
                        </g>
                    )}
                </g>

                {!deps.length && !refs.length && (
                    <text
                        x={cx}
                        y={cy + 80}
                        textAnchor="middle"
                        fontSize={12}
                        fill={THEME.textDim}
                        fontFamily="'Fira Code',monospace"
                    >
                        No FK relationships found
                    </text>
                )}
                <text
                    x={cx}
                    y={H - 12}
                    textAnchor="middle"
                    fontSize={9}
                    fill={THEME.textDim}
                    fontFamily="'Fira Code',monospace"
                    opacity={0.5}
                >
                    Click any node to pivot · Click center to go back
                </text>
            </g>
        );
    };

    /* ── GLOBAL RADIAL VIEW: all tables as branches ──────── */
    const GlobalView = () => {
        const displayRows = [...rows]
            .sort((a, b) => b.refsBy.length + b.refsTo.length - (a.refsBy.length + a.refsTo.length))
            .slice(0, 18);
        const N = displayRows.length;
        const R = N <= 5 ? 185 : N <= 9 ? 205 : N <= 13 ? 218 : 232;

        return (
            <g>
                {/* Decorative guide ring */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={R + 38}
                    fill="none"
                    stroke={THEME.glassBorder}
                    strokeWidth={0.5}
                    strokeDasharray="5 7"
                    strokeOpacity={0.3}
                />

                {displayRows.map((t, i) => {
                    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const nx = cx + R * cos;
                    const ny = cy + R * sin;
                    const color = CHART_COLORS[i % CHART_COLORS.length];
                    const isCrit = t.refsBy.length > 2;
                    const degree = t.refsTo.length + t.refsBy.length;
                    const lit = hovered === t.name;
                    const pillW = Math.max(60, sn(t.name, 13).length * 5.6 + 24);
                    const pillH = 24;

                    /* Branch from center ellipse edge to pill edge */
                    const ex = cx + 76 * cos,
                        ey = cy + 44 * sin;
                    const tx = nx - (pillW / 2) * cos,
                        ty = ny - (pillH / 2) * sin;

                    /* Organic arc: slight perpendicular bow */
                    const bow = 28;
                    const mx = (ex + tx) / 2 - sin * bow;
                    const my = (ey + ty) / 2 + cos * bow;
                    const brW = isCrit ? 4.5 : degree > 3 ? 3.5 : 2.5;
                    const d = `M ${ex} ${ey} Q ${mx} ${my} ${tx} ${ty}`;

                    /* Sub-branches: up to 2 FK deps shown as small feathers */
                    const subItems = t.refsTo.slice(0, 2);

                    return (
                        <g
                            key={t.name}
                            onMouseEnter={() => setHovered(t.name)}
                            onMouseLeave={() => setHovered(null)}
                            onClick={() => setSelected(t.name)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Main branch */}
                            <path
                                d={d}
                                fill="none"
                                stroke={color}
                                strokeWidth={lit ? brW + 1.8 : brW}
                                strokeOpacity={lit ? 0.95 : 0.6}
                                strokeLinecap="round"
                                style={{ transition: 'all 0.18s' }}
                            />

                            {/* Sub-branches (feathers off the main branch) */}
                            {subItems.map((sub, si) => {
                                const featherAngle = angle - 0.38 + si * 0.38;
                                const fR = R + 58;
                                const fx = cx + fR * Math.cos(featherAngle);
                                const fy = cy + fR * Math.sin(featherAngle);
                                const sd = makeSubBranch(nx, ny, fx, fy);
                                const spw = Math.max(44, sn(sub, 8).length * 4.6 + 14);
                                return (
                                    <g key={sub}>
                                        <path
                                            d={sd}
                                            fill="none"
                                            stroke={color}
                                            strokeWidth={1.2}
                                            strokeOpacity={0.35}
                                            strokeDasharray="3.5 2.5"
                                        />
                                        <rect
                                            x={fx - spw / 2}
                                            y={fy - 9}
                                            width={spw}
                                            height={18}
                                            rx={9}
                                            fill={`${color}10`}
                                            stroke={color}
                                            strokeWidth={0.8}
                                            strokeOpacity={0.45}
                                        />
                                        <text
                                            x={fx}
                                            y={fy}
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            fontSize={7}
                                            fill={color}
                                            opacity={0.7}
                                            fontFamily="'Fira Code',monospace"
                                        >
                                            {sn(sub, 8)}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Main pill node */}
                            <PillNode
                                x={nx}
                                y={ny}
                                label={sn(t.name, 13)}
                                color={color}
                                size={isCrit || degree > 3 ? 'md' : 'sm'}
                            />

                            {/* Critical badge */}
                            {isCrit && (
                                <>
                                    <circle cx={nx + pillW / 2 + 2} cy={ny - 10} r={7} fill={THEME.danger} />
                                    <text
                                        x={nx + pillW / 2 + 2}
                                        y={ny - 10}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize={7.5}
                                        fontWeight={800}
                                        fill={THEME.textMain}
                                    >
                                        !
                                    </text>
                                </>
                            )}

                            {/* Connectivity badge below pill */}
                            {degree > 0 && (
                                <text
                                    x={nx}
                                    y={ny + 17}
                                    textAnchor="middle"
                                    fontSize={7}
                                    fill={color}
                                    opacity={0.55}
                                    fontFamily="'Fira Code',monospace"
                                >
                                    {t.refsTo.length > 0 ? `→${t.refsTo.length}` : ''}
                                    {t.refsTo.length > 0 && t.refsBy.length > 0 ? ' ' : ''}
                                    {t.refsBy.length > 0 ? `←${t.refsBy.length}` : ''}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* ── Premium Center Hub — Global ── */}
                <g>
                    {/* Outermost soft halo */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={104}
                        ry={66}
                        fill="none"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={1}
                        strokeOpacity={0.07}
                        filter="url(#mm-glow)"
                        style={{ animation: 'ud-pulse 4.5s ease-in-out infinite' }}
                    />
                    {/* Dashed orbit ring */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={94}
                        ry={60}
                        fill="none"
                        stroke="url(#rim-grad)"
                        strokeWidth={0.9}
                        strokeDasharray="7 5"
                        strokeOpacity={0.35}
                    />
                    {/* Subtle mid ring */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={84}
                        ry={52}
                        fill={`${CHART_COLORS[1]}0a`}
                        stroke={CHART_COLORS[1]}
                        strokeWidth={0.5}
                        strokeOpacity={0.15}
                    />
                    {/* Main body */}
                    <ellipse cx={cx} cy={cy} rx={76} ry={46} fill="url(#hub-grad-global)" />
                    {/* Gloss sheen */}
                    <ellipse cx={cx - 17} cy={cy - 13} rx={38} ry={20} fill="white" fillOpacity={0.04} />
                    {/* Rim */}
                    <ellipse cx={cx} cy={cy} rx={76} ry={46} fill="none" stroke="url(#rim-grad)" strokeWidth={2} />
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={73}
                        ry={43}
                        fill="none"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={0.4}
                        strokeOpacity={0.18}
                    />

                    {/* Title */}
                    <text
                        x={cx}
                        y={cy - 9}
                        textAnchor="middle"
                        fontSize={13}
                        fontWeight={800}
                        fill={THEME.textMain}
                        fontFamily="'Plus Jakarta Sans',sans-serif"
                        letterSpacing="0.015em"
                    >
                        Dependency
                    </text>
                    {/* Subtitle */}
                    <text
                        x={cx}
                        y={cy + 9}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={600}
                        fill={CHART_COLORS[1]}
                        fontFamily="'Fira Code',monospace"
                        fillOpacity={0.8}
                    >
                        Mind Map
                    </text>
                    {/* Row count badge */}
                    <text
                        x={cx}
                        y={cy + 23}
                        textAnchor="middle"
                        fontSize={7.5}
                        fontWeight={500}
                        fill={CHART_COLORS[4]}
                        fontFamily="'Fira Code',monospace"
                        fillOpacity={0.55}
                    >
                        {rows.length} tables
                    </text>

                    {/* Orbit dots */}
                    {[0, 90, 180, 270].map((deg, i) => {
                        const rad = (deg * Math.PI) / 180;
                        return (
                            <circle
                                key={i}
                                cx={cx + 94 * Math.cos(rad)}
                                cy={cy + 60 * Math.sin(rad)}
                                r={2.5}
                                fill={[CHART_COLORS[1], CHART_COLORS[0], CHART_COLORS[2], CHART_COLORS[3]][i]}
                                fillOpacity={0.65}
                            />
                        );
                    })}
                </g>

                <text
                    x={cx}
                    y={H - 14}
                    textAnchor="middle"
                    fontSize={9}
                    fill={THEME.textDim}
                    fontFamily="'Fira Code',monospace"
                    opacity={0.55}
                >
                    {rows.length > 18
                        ? `Top 18 of ${rows.length} tables · Click any node to explore`
                        : 'Click any node to explore its FK relationships'}
                </text>
            </g>
        );
    };

    /* ── RENDER ─────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header + toggle */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 22,
                }}
            >
                <SecHead
                    Icon={Zap}
                    accent={THEME.cyan}
                    title="Dependency Mind Map"
                    sub="FK relationships & cascade chains — click any branch to explore"
                />
                <div style={{ display: 'flex', gap: 6 }}>
                    {['map', 'table'].map((m) => (
                        <button
                            key={m}
                            className="ud-btn"
                            onClick={() => setViewMode(m)}
                            style={{
                                padding: '5px 12px',
                                borderRadius: 18,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: THEME.fontMono,
                                cursor: 'pointer',
                                background: viewMode === m ? `${THEME.cyan}20` : 'transparent',
                                border: `1px solid ${viewMode === m ? THEME.cyan : THEME.glassBorder}`,
                                color: viewMode === m ? THEME.cyan : THEME.textDim,
                            }}
                        >
                            {m === 'map' ? '✦ Mind Map' : '☰ Table'}
                        </button>
                    ))}
                    {selected && (
                        <button
                            className="ud-btn"
                            onClick={() => setSelected(null)}
                            style={{
                                padding: '5px 10px',
                                borderRadius: 18,
                                fontSize: 11,
                                fontFamily: THEME.fontMono,
                                cursor: 'pointer',
                                background: `${THEME.danger}15`,
                                border: `1px solid ${THEME.danger}40`,
                                color: THEME.danger,
                            }}
                        >
                            ✕ Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div
                style={{
                    display: 'flex',
                    gap: 20,
                    flexWrap: 'wrap',
                    padding: '7px 14px',
                    borderRadius: 20,
                    background: `${THEME.glassBorder}22`,
                }}
            >
                {[
                    { color: CHART_COLORS[0], label: 'Depends On (outgoing FK)' },
                    { color: CHART_COLORS[1], label: 'Referenced By (incoming FK)' },
                    { color: THEME.danger, label: 'Critical node (3+ refs)' },
                    { color: THEME.textDim, label: 'Sub-branch (2nd-level link)', dash: true },
                ].map(({ color, label, dash }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {dash ? (
                            <svg width={18} height={8}>
                                <line
                                    x1={0}
                                    y1={4}
                                    x2={18}
                                    y2={4}
                                    stroke={color}
                                    strokeWidth={1.5}
                                    strokeDasharray="4 2"
                                />
                            </svg>
                        ) : (
                            <div style={{ width: 22, height: 3, borderRadius: 2, background: color }} />
                        )}
                        <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>{label}</span>
                    </div>
                ))}
            </div>

            {viewMode === 'map' ? (
                <div
                    style={{
                        borderRadius: 20,
                        overflow: 'hidden',
                        border: `1px solid ${THEME.glassBorder}`,
                        background: `radial-gradient(ellipse at 50% 50%, ${THEME.cyan}05 0%, ${THEME.deepTeal} 70%)`,
                    }}
                >
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                        <defs>
                            {/* Soft glow filter */}
                            <filter id="mm-glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="6" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <filter id="mm-glow-sm" x="-40%" y="-40%" width="180%" height="180%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                            <filter id="mm-inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="shadow" />
                                <feOffset dx="0" dy="2" result="offset" />
                                <feComposite in="SourceGraphic" in2="offset" operator="over" />
                            </filter>
                            {/* Center hub gradient — focused view */}
                            <radialGradient id="hub-grad-focus" cx="38%" cy="35%" r="65%">
                                <stop offset="0%" stopColor={`${THEME.surface}dd`} />
                                <stop offset="45%" stopColor={THEME.bg} />
                                <stop offset="100%" stopColor={THEME.deepTeal} />
                            </radialGradient>
                            {/* Center hub gradient — global view */}
                            <radialGradient id="hub-grad-global" cx="38%" cy="35%" r="65%">
                                <stop offset="0%" stopColor={THEME.surface} />
                                <stop offset="50%" stopColor={THEME.bg} />
                                <stop offset="100%" stopColor={THEME.mariana} />
                            </radialGradient>
                            {/* Rim gradient — light sweep */}
                            <linearGradient id="rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity="0.9" />
                                <stop offset="40%" stopColor={CHART_COLORS[4]} stopOpacity="0.6" />
                                <stop offset="100%" stopColor={THEME.info} stopOpacity="0.2" />
                            </linearGradient>
                            {/* Stat badge gradient */}
                            <linearGradient id="badge-dep" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity="0.18" />
                                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity="0.06" />
                            </linearGradient>
                            <linearGradient id="badge-ref" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity="0.18" />
                                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity="0.06" />
                            </linearGradient>
                        </defs>
                        {focusRow ? <FocusedView /> : <GlobalView />}
                    </svg>
                </div>
            ) : (
                <Card>
                    <THead cols="1fr 1.5fr 1.5fr" labels={['Table', 'Depends On (FK)', 'Referenced By']} />
                    {rows.map((t, i) => (
                        <TRow key={i} cols="1fr 1.5fr 1.5fr" i={i}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: THEME.cyan }}>{t.name}</div>
                                {t.refsBy.length > 2 && (
                                    <Chip color={THEME.danger} size="sm">
                                        Critical
                                    </Chip>
                                )}
                            </div>
                            <span style={{ fontSize: 12, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                {t.refsTo.length ? t.refsTo.join(', ') : '—'}
                            </span>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: t.refsBy.length ? THEME.textMuted : THEME.textDim,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                {t.refsBy.length ? t.refsBy.join(', ') : '—'}
                            </span>
                        </TRow>
                    ))}
                </Card>
            )}
        </div>
    );
}

function S_Write() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/stats');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = data
        .filter((t) => matchFilter(t, f))
        .filter((t) => Number(t.updates) > 0 || Number(t.inserts) > 0)
        .slice(0, 10);
    if (!rows.length) return <EmptyUI msg="No write activity for the selected scope." />;
    const chartData = rows
        .slice(0, 8)
        .map((t) => ({ name: t.name, updates: Number(t.updates), inserts: Number(t.inserts) }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Shield}
                accent={THEME.warning}
                title="Write Amplification"
                sub="HOT update percentage, tuple update vs. insert ratios, WAL impact"
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} barCategoryGap="30%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="updates" name="Updates" fill={THEME.warning} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="inserts" name="Inserts" fill={THEME.primary} radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <Card>
                <THead cols="1.5fr 1fr 1fr 1.2fr" labels={['Table', 'Updates/hr', 'Inserts/hr', 'HOT %']} />
                {rows.map((w, i) => {
                    const hot = Number(w.hotPct);
                    const c = hot > 80 ? THEME.success : hot > 30 ? THEME.warning : THEME.danger;
                    return (
                        <TRow key={i} cols="1.5fr 1fr 1fr 1.2fr" i={i}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textMain }}>{w.name}</div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: THEME.textDim,
                                        fontFamily: THEME.fontMono,
                                        marginTop: 2,
                                    }}
                                >
                                    {w.schema}
                                </div>
                            </div>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.textMuted }}>
                                {Number(w.updates).toLocaleString()}
                            </span>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.textMuted }}>
                                {Number(w.inserts).toLocaleString()}
                            </span>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span
                                        style={{ fontFamily: THEME.fontMono, fontSize: 12, color: c, fontWeight: 600 }}
                                    >
                                        {hot}%
                                    </span>
                                </div>
                                <Bar2 v={hot} max={100} color={c} h={4} />
                                {hot < 30 && Number(w.updates) > 100 && (
                                    <div style={{ fontSize: 10, color: THEME.danger, marginTop: 4 }}>
                                        ↓ Lower fillfactor
                                    </div>
                                )}
                            </div>
                        </TRow>
                    );
                })}
            </Card>
        </div>
    );
}

function S_Indexes() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/indexes');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = data.filter((ix) => (!f.schema || ix.schema === f.schema) && (!f.table || ix.tableName === f.table));
    if (!rows.length) return <EmptyUI msg="No indexes found for the selected table." />;
    const unused = rows.filter((ix) => Number(ix.scans ?? 0) === 0);
    const chartData = rows
        .slice(0, 10)
        .map((ix) => ({
            name: ix.name?.slice(0, 14) + (ix.name?.length > 14 ? '…' : ''),
            scans: Number(ix.scans ?? 0),
        }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Eye}
                accent={THEME.primary}
                title="Index Analysis"
                sub="Usage rates, sizes, scan counts, and unused index detection"
                right={
                    <div style={{ display: 'flex', gap: 20 }}>
                        <Chip color={THEME.primary}>{rows.length} indexes</Chip>
                        {unused.length > 0 && <Chip color={THEME.danger}>{unused.length} unused</Chip>}
                    </div>
                }
            />
            {unused.length > 0 && (
                <div
                    style={{
                        padding: '18px 22px',
                        borderRadius: 16,
                        background: `${THEME.danger}0d`,
                        border: `1px solid ${THEME.danger}25`,
                        fontSize: 13,
                        color: THEME.danger,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 22,
                    }}
                >
                    <AlertTriangle size={15} />
                    {unused.length} unused index{unused.length > 1 ? 'es' : ''} detected — consuming write overhead with
                    no read benefit.
                </div>
            )}
            <Card style={{ padding: '18px 18px 10px' }}>
                <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={chartData} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 9, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="scans" name="Scans" radius={[3, 3, 0, 0]}>
                            {chartData.map((d, i) => (
                                <Cell
                                    key={i}
                                    fill={d.scans === 0 ? THEME.danger : d.scans < 10 ? THEME.warning : THEME.success}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <Card style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 780 }}>
                    <THead
                        cols="2fr 1fr 1fr 1fr 1fr 1.2fr"
                        labels={['Index Name', 'Table', 'Type', 'Size', 'Scans', 'Status']}
                    />
                    {rows.map((ix, i) => {
                        const scans = Number(ix.scans ?? 0);
                        const isU = scans === 0;
                        const sc = isU ? THEME.danger : scans < 10 ? THEME.warning : THEME.success;
                        const sl = isU ? 'Unused' : scans < 10 ? 'Rare' : 'Active';
                        const sizeMb = ix.sizeBytes ? `${(ix.sizeBytes / 1048576).toFixed(1)} MB` : '—';
                        return (
                            <TRow key={i} cols="2fr 1fr 1fr 1fr 1fr 1.2fr" i={i}>
                                <div>
                                    <div
                                        style={{
                                            fontFamily: THEME.fontMono,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: THEME.textMain,
                                        }}
                                    >
                                        {ix.name}
                                    </div>
                                    {ix.definition && (
                                        <div
                                            style={{
                                                fontSize: 9,
                                                color: THEME.textDim,
                                                marginTop: 2,
                                                fontFamily: THEME.fontMono,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 240,
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                            title={ix.definition}
                                        >
                                            {ix.definition}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                                        {ix.isPrimary && (
                                            <Chip color={THEME.purple} size="sm">
                                                PK
                                            </Chip>
                                        )}
                                        {ix.isUnique && (
                                            <Chip color={THEME.cyan} size="sm">
                                                UQ
                                            </Chip>
                                        )}
                                    </div>
                                </div>
                                <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                    {ix.tableName}
                                </span>
                                <Chip color={THEME.primary} size="sm">
                                    {(ix.type || 'btree').toUpperCase()}
                                </Chip>
                                <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textMuted }}>
                                    {ix.size || sizeMb}
                                </span>
                                <span
                                    style={{
                                        fontFamily: THEME.fontMono,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: isU ? THEME.danger : THEME.success,
                                    }}
                                >
                                    {scans.toLocaleString()}
                                </span>
                                <div>
                                    <Chip color={sc} size="sm">
                                        {sl}
                                    </Chip>
                                    {isU && (
                                        <div style={{ fontSize: 9, color: THEME.danger, marginTop: 4 }}>
                                            → Consider dropping
                                        </div>
                                    )}
                                </div>
                            </TRow>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

function S_Sizes() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/sizes');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;
    const rows = data.filter((s) => (!f.schema || s.schema === f.schema) && (!f.table || s.name === f.table));
    if (!rows.length) return <EmptyUI msg="No size data for the selected scope." />;
    const chartData = rows
        .slice(0, 8)
        .map((s) => ({
            name: s.name,
            heap: Number(s.heapBytes ?? 0) / 1048576,
            idx: Number(s.indexBytes ?? 0) / 1048576,
            toast: Number(s.toastBytes ?? 0) / 1048576,
        }));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Cpu}
                accent={THEME.cyan}
                title="Table Size Breakdown"
                sub="Heap, index, and TOAST storage split with bloat ratio analysis"
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={32}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="heap" name="Heap" stackId="a" fill={THEME.cyan} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="idx" name="Indexes" stackId="a" fill={THEME.purple} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="toast" name="TOAST" stackId="a" fill={THEME.warning} radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 20 }}>
                {rows.map((s, i) => {
                    const heap = Number(s.heapBytes ?? 0);
                    const idx = Number(s.indexBytes ?? 0);
                    const toast = Number(s.toastBytes ?? 0);
                    const total = heap + idx + toast || 1;
                    const bloat = Number(s.bloatPct ?? 0);
                    const bc = bloat > 30 ? THEME.danger : bloat > 15 ? THEME.warning : THEME.success;
                    const segs = [
                        { label: 'Heap', bytes: heap, color: THEME.cyan, pct: (heap / total) * 100 },
                        { label: 'Indexes', bytes: idx, color: THEME.purple, pct: (idx / total) * 100 },
                        { label: 'TOAST', bytes: toast, color: THEME.warning, pct: (toast / total) * 100 },
                    ];
                    return (
                        <Card key={i} style={{ padding: 18 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: 14,
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: THEME.textMain }}>{s.name}</div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: THEME.textDim,
                                            fontFamily: THEME.fontMono,
                                            marginTop: 2,
                                        }}
                                    >
                                        {s.schema} · {fmtB(total)}
                                    </div>
                                </div>
                                <Chip color={bc}>Bloat {bloat}%</Chip>
                            </div>
                            <StackBar segs={segs} h={9} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 12 }}>
                                {segs.map((seg) => (
                                    <div
                                        key={seg.label}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                            <div
                                                style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }}
                                            />
                                            <span style={{ fontSize: 12, color: THEME.textDim }}>{seg.label}</span>
                                        </div>
                                        <span
                                            style={{ fontFamily: THEME.fontMono, fontSize: 12, color: THEME.textMuted }}
                                        >
                                            {fmtB(seg.bytes)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {bloat > 30 && (
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: '7px 10px',
                                        borderRadius: 18,
                                        background: `${THEME.danger}0d`,
                                        border: `1px solid ${THEME.danger}20`,
                                        fontSize: 11,
                                        color: THEME.danger,
                                    }}
                                >
                                    → Consider VACUUM FULL or pg_repack
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ★ SECTION: QUERY PERFORMANCE (pg_stat_statements)
═══════════════════════════════════════════════════════════════ */
function S_QueryPerf() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/queries');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;

    const rows = data
        .filter((q) => !f.table || (q.query || '').toLowerCase().includes(f.table.toLowerCase()))
        .slice(0, 20);
    if (!rows.length) return <EmptyUI msg="No query stats. Ensure pg_stat_statements is installed." />;

    const maxMean = rows.length > 0 ? Math.max(...rows.map((q) => safeNum(q.meanMs ?? q.mean_exec_time))) : 1;
    const chartData = rows
        .slice(0, 8)
        .map((q) => ({
            name: (q.query || '').slice(0, 16) + '…',
            calls: safeNum(q.calls),
            mean: safeNum(q.meanMs ?? q.mean_exec_time),
        }));
    const totalCalls = rows.reduce((s, q) => s + safeNum(q.calls), 0);
    const slowQueries = rows.filter((q) => safeNum(q.meanMs ?? q.mean_exec_time) > 100).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={FileText}
                accent={THEME.warning}
                title="Query Performance"
                sub="Slow queries, call frequency, and execution time from pg_stat_statements"
                right={
                    <div style={{ display: 'flex', gap: 20 }}>
                        <Chip color={THEME.primary}>{totalCalls.toLocaleString()} calls</Chip>
                        {slowQueries > 0 && <Chip color={THEME.danger}>{slowQueries} slow</Chip>}
                    </div>
                }
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                {[
                    { label: 'Total Queries', val: rows.length, color: THEME.primary },
                    { label: 'Total Calls', val: totalCalls.toLocaleString(), color: THEME.cyan },
                    { label: 'Slow (>100ms)', val: slowQueries, color: slowQueries > 0 ? THEME.danger : THEME.success },
                    {
                        label: 'Avg Mean Time',
                        val: fmtMs(
                            Math.round(
                                rows.reduce((s, q) => s + safeNum(q.meanMs ?? q.mean_exec_time), 0) / rows.length,
                            ),
                        ),
                        color: THEME.warning,
                    },
                ].map((k, i) => (
                    <Card key={i} style={{ padding: '18px 22px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: THEME.fontMono }}>
                            {k.val}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 4 }}>{k.label}</div>
                    </Card>
                ))}
            </div>
            <Card style={{ padding: '18px 18px 10px' }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: THEME.textDim,
                        letterSpacing: '.07em',
                        marginBottom: 12,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    Call Frequency vs. Mean Exec Time (ms)
                </div>
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 9, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar yAxisId="left" dataKey="calls" name="Calls" fill={THEME.primary} radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="right" dataKey="mean" name="Mean ms" fill={THEME.warning} radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <Card style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 800 }}>
                    <THead
                        cols="3fr 1fr 1fr 1fr 1fr 1fr"
                        labels={['Query', 'Calls', 'Mean', 'Max', 'Total Time', 'Rows/Call']}
                    />
                    {rows.map((q, i) => {
                        const mean = safeNum(q.meanMs ?? q.mean_exec_time);
                        const max = safeNum(q.maxMs ?? q.max_exec_time);
                        const tot = safeNum(q.totalMs ?? q.total_exec_time);
                        const rpc = safeNum(q.calls) > 0 ? (safeNum(q.rows) / safeNum(q.calls)).toFixed(1) : '0';
                        const mc = mean > 500 ? THEME.danger : mean > 100 ? THEME.warning : THEME.success;
                        const qShort = (q.query || '').replace(/\s+/g, ' ').slice(0, 80);
                        return (
                            <TRow key={i} cols="3fr 1fr 1fr 1fr 1fr 1fr" i={i}>
                                <div>
                                    <div
                                        style={{
                                            fontFamily: THEME.fontMono,
                                            fontSize: 10,
                                            color: THEME.textMuted,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: 380,
                                            flex: 1,
                                            minWidth: 0,
                                        }}
                                        title={q.query}
                                    >
                                        {qShort}
                                    </div>
                                    {mean > 100 && (
                                        <div style={{ fontSize: 9, color: THEME.danger, marginTop: 3 }}>
                                            ⚠ Slow query detected
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textMuted }}>
                                    {safeNum(q.calls).toLocaleString()}
                                </span>
                                <span style={{ fontFamily: THEME.fontMono, fontSize: 11, fontWeight: 600, color: mc }}>
                                    {fmtMs(Math.round(mean))}
                                </span>
                                <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textDim }}>
                                    {fmtMs(Math.round(max))}
                                </span>
                                <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textDim }}>
                                    {fmtMs(Math.round(tot))}
                                </span>
                                <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textDim }}>
                                    {rpc}
                                </span>
                            </TRow>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ★ SECTION: LOCK & CONTENTION MONITOR
═══════════════════════════════════════════════════════════════ */
function S_Locks() {
    const { data, loading, error } = useTableData('/api/tables/locks');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;

    const blocked = data.filter((l) => l.blocked || l.waiting);
    const lockTypes = [...new Set(data.map((l) => l.lockType || l.locktype).filter(Boolean))];

    const pieData = lockTypes.map((lt) => ({
        name: lt,
        value: data.filter((l) => (l.lockType || l.locktype) === lt).length,
    }));
    const PIE_COLORS = [THEME.primary, THEME.cyan, THEME.purple, THEME.warning, THEME.success, THEME.danger];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Lock}
                accent={THEME.danger}
                title="Lock & Contention Monitor"
                sub="Active locks, blocking chains, and deadlock risk from pg_locks"
                right={
                    <div style={{ display: 'flex', gap: 20 }}>
                        <Chip color={THEME.primary}>{data.length} locks</Chip>
                        {blocked.length > 0 && <Chip color={THEME.danger}>{blocked.length} blocked</Chip>}
                    </div>
                }
            />
            {blocked.length > 0 && (
                <div
                    style={{
                        padding: '18px 22px',
                        borderRadius: 16,
                        background: `${THEME.danger}0d`,
                        border: `1px solid ${THEME.danger}25`,
                        fontSize: 13,
                        color: THEME.danger,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 22,
                    }}
                >
                    <AlertTriangle size={15} />
                    {blocked.length} session{blocked.length > 1 ? 's are' : ' is'} blocked — potential deadlock or
                    long-running transaction holding locks.
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: THEME.textDim,
                            letterSpacing: '.07em',
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        Lock Types
                    </div>
                    {pieData.length > 0 ? (
                        <>
                            <PieChart width={140} height={140}>
                                <Pie
                                    data={pieData}
                                    cx={65}
                                    cy={65}
                                    innerRadius={38}
                                    outerRadius={60}
                                    dataKey="value"
                                    paddingAngle={3}
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTip />} />
                            </PieChart>
                            <div
                                style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center' }}
                            >
                                {pieData.map((d, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div
                                            style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 2,
                                                background: PIE_COLORS[i % PIE_COLORS.length],
                                            }}
                                        />
                                        <span style={{ fontSize: 10, color: THEME.textDim }}>
                                            {d.name} ({d.value})
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <EmptyUI msg="No locks detected." />
                    )}
                </Card>
                <Card>
                    <THead cols="1fr 1fr 1fr 1fr 1fr" labels={['PID', 'Relation', 'Lock Type', 'Mode', 'Status']} />
                    {data.length === 0 ? (
                        <div
                            style={{
                                padding: 36,
                                textAlign: 'center',
                                color: THEME.textDim,
                                fontSize: 13,
                                fontFamily: THEME.fontMono,
                            }}
                        >
                            No active locks.
                        </div>
                    ) : (
                        data.slice(0, 12).map((l, i) => {
                            const isBlocked = l.blocked || l.waiting;
                            const sc = isBlocked ? THEME.danger : THEME.success;
                            return (
                                <TRow key={i} cols="1fr 1fr 1fr 1fr 1fr" i={i}>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textMuted }}>
                                        {l.pid}
                                    </span>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textDim }}>
                                        {l.relation || l.relname || '—'}
                                    </span>
                                    <Chip color={THEME.primary} size="sm">
                                        {(l.lockType || l.locktype || 'relation').slice(0, 10)}
                                    </Chip>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.textDim }}>
                                        {(l.mode || '').replace('Lock', '')}
                                    </span>
                                    <Chip color={sc} size="sm">
                                        {isBlocked ? 'Blocked' : 'Granted'}
                                    </Chip>
                                </TRow>
                            );
                        })
                    )}
                </Card>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ★ SECTION: AUTOVACUUM TRACKER
═══════════════════════════════════════════════════════════════ */
function S_Autovacuum() {
    const f = useContext(FilterCtx);
    const { data, loading, error } = useTableData('/api/tables/autovacuum');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;

    const rows = data.filter((t) => matchFilter(t, f));
    if (!rows.length) return <EmptyUI msg="No autovacuum data. Check pg_stat_user_tables." />;

    const neverVacuumed = rows.filter((t) => !t.lastVacuum && !t.lastAutovacuum).length;
    const overdue = rows.filter((t) => {
        const last = t.lastAutovacuum || t.lastVacuum;
        if (!last) return true;
        const daysAgo = (Date.now() - new Date(last).getTime()) / 86400000;
        return daysAgo > 7;
    }).length;

    const chartData = rows.slice(0, 8).map((t) => ({
        name: t.name,
        vacuumCount: safeNum(t.vacuumCount ?? t.vacuum_count),
        analyzeCount: safeNum(t.analyzeCount ?? t.analyze_count),
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={RefreshCw}
                accent={THEME.success}
                title="Autovacuum Tracker"
                sub="Last vacuum/analyze timestamps, daemon run counts, and overdue tables"
                right={
                    <div style={{ display: 'flex', gap: 20 }}>
                        {neverVacuumed > 0 && <Chip color={THEME.danger}>{neverVacuumed} never vacuumed</Chip>}
                        {overdue > 0 && <Chip color={THEME.warning}>{overdue} overdue</Chip>}
                    </div>
                }
            />
            <Card style={{ padding: '18px 18px 10px' }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: THEME.textDim,
                        letterSpacing: '.07em',
                        marginBottom: 12,
                        fontFamily: THEME.fontMono,
                    }}
                >
                    Vacuum & Analyze Run Counts
                </div>
                <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={chartData} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke={`${THEME.glassBorder}60`} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: THEME.textDim, fontSize: 10, fontFamily: THEME.fontMono }}
                            axisLine={false}
                            tickLine={false}
                            width={28}
                        />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="vacuumCount" name="Vacuum" fill={THEME.success} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="analyzeCount" name="Analyze" fill={THEME.cyan} radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>
            <Card>
                <THead
                    cols="1.5fr 1fr 1fr 1fr 1fr 1fr"
                    labels={['Table', 'Last Vacuum', 'Last Analyze', 'V Count', 'A Count', 'Status']}
                />
                {rows.map((t, i) => {
                    const last = t.lastAutovacuum || t.lastVacuum;
                    const daysAgo = last ? (Date.now() - new Date(last).getTime()) / 86400000 : 999;
                    const sc = daysAgo > 7 ? THEME.danger : daysAgo > 3 ? THEME.warning : THEME.success;
                    const sl = !last ? 'Never' : daysAgo > 7 ? 'Overdue' : 'Recent';
                    const fmt = (d) => (d ? new Date(d).toLocaleDateString() : '—');
                    return (
                        <TRow key={i} cols="1.5fr 1fr 1fr 1fr 1fr 1fr" i={i}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: THEME.textMain }}>{t.name}</div>
                                <div style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                    {t.schema}
                                </div>
                            </div>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.textDim }}>
                                {fmt(t.lastVacuum || t.lastAutovacuum)}
                            </span>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.textDim }}>
                                {fmt(t.lastAnalyze || t.lastAutoanalyze)}
                            </span>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.success }}>
                                {safeNum(t.vacuumCount ?? t.vacuum_count)}
                            </span>
                            <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.cyan }}>
                                {safeNum(t.analyzeCount ?? t.analyze_count)}
                            </span>
                            <Chip color={sc} size="sm">
                                {sl}
                            </Chip>
                        </TRow>
                    );
                })}
            </Card>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ★ SECTION: CONNECTION POOL STATS
═══════════════════════════════════════════════════════════════ */
function S_Connections() {
    const { data: raw, loading, error } = useTableData('/api/tables/connections');
    if (loading) return <Loader />;
    if (error) return <ErrUI msg={error} />;

    const data = Array.isArray(raw) ? raw : [];
    const total = data.reduce((s, c) => s + safeNum(c.count ?? c.total), 0);
    const active = data
        .filter((c) => (c.state || '').toLowerCase() === 'active')
        .reduce((s, c) => s + safeNum(c.count ?? c.total), 0);
    const idle = data
        .filter((c) => (c.state || '').toLowerCase().includes('idle'))
        .reduce((s, c) => s + safeNum(c.count ?? c.total), 0);
    const waiting = data
        .filter((c) => (c.state || '').toLowerCase().includes('wait'))
        .reduce((s, c) => s + safeNum(c.count ?? c.total), 0);

    const stateGroups = [...new Set(data.map((c) => c.state).filter(Boolean))];
    const chartData = stateGroups.map((s) => ({
        name: s,
        count: data.filter((c) => c.state === s).reduce((sum, c) => sum + safeNum(c.count ?? c.total), 0),
    }));
    const PIE_COLORS = [THEME.success, THEME.warning, THEME.danger, THEME.primary, THEME.cyan, THEME.purple];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={Users}
                accent={THEME.cyan}
                title="Connection Pool Stats"
                sub="Active, idle, and waiting connections from pg_stat_activity"
                right={<Chip color={total > 80 ? THEME.danger : THEME.primary}>{total} total</Chip>}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
                {[
                    { label: 'Total', val: total, color: THEME.primary },
                    { label: 'Active', val: active, color: THEME.success },
                    { label: 'Idle', val: idle, color: THEME.warning },
                    { label: 'Waiting', val: waiting, color: waiting > 0 ? THEME.danger : THEME.textDim },
                ].map((k, i) => (
                    <Card key={i} style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: k.color, fontFamily: THEME.fontMono }}>
                            {k.val}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 4 }}>{k.label} connections</div>
                        <Bar2 v={k.val} max={total || 1} color={k.color} h={3} />
                    </Card>
                ))}
            </div>
            {total > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
                    <Card
                        style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}
                    >
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: THEME.textDim,
                                letterSpacing: '.07em',
                                fontFamily: THEME.fontMono,
                            }}
                        >
                            By State
                        </div>
                        <PieChart width={140} height={140}>
                            <Pie
                                data={chartData}
                                cx={65}
                                cy={65}
                                innerRadius={38}
                                outerRadius={60}
                                dataKey="count"
                                paddingAngle={3}
                            >
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTip />} />
                        </PieChart>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center' }}>
                            {chartData.map((d, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 2,
                                            background: PIE_COLORS[i % PIE_COLORS.length],
                                        }}
                                    />
                                    <span style={{ fontSize: 10, color: THEME.textDim }}>
                                        {d.name} ({d.count})
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <THead cols="1fr 1fr 1fr 1fr" labels={['App', 'User', 'DB', 'Count']} />
                        {data.slice(0, 10).map((c, i) => {
                            const cnt = safeNum(c.count ?? c.total);
                            const sc = (c.state || '').includes('active')
                                ? THEME.success
                                : (c.state || '').includes('idle')
                                  ? THEME.warning
                                  : THEME.textDim;
                            return (
                                <TRow key={i} cols="1fr 1fr 1fr 1fr" i={i}>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textMuted }}>
                                        {c.appName || c.application_name || '—'}
                                    </span>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textDim }}>
                                        {c.useName || c.user || '—'}
                                    </span>
                                    <span style={{ fontFamily: THEME.fontMono, fontSize: 11, color: THEME.textDim }}>
                                        {c.datName || c.db || '—'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <span
                                            style={{
                                                fontFamily: THEME.fontMono,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: sc,
                                            }}
                                        >
                                            {cnt}
                                        </span>
                                        <Chip color={sc} size="sm">
                                            {c.state || '—'}
                                        </Chip>
                                    </div>
                                </TRow>
                            );
                        })}
                    </Card>
                </div>
            )}
            {total === 0 && <EmptyUI msg="No connection data. Check pg_stat_activity access." />}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   ★ SECTION: AI DEEP ANALYSIS  (Claude-powered)
   FIX: robust JSON parsing + max_tokens bumped to 2000
═══════════════════════════════════════════════════════════════ */

const SeverityBadge = ({ level }) => {
    const map = {
        critical: { color: THEME.danger, icon: '🔴', label: 'Critical' },
        warning: { color: THEME.warning, icon: '🟡', label: 'Warning' },
        info: { color: THEME.primary, icon: '🔵', label: 'Info' },
        success: { color: THEME.success, icon: '🟢', label: 'Healthy' },
    };
    const m = map[level] || map.info;
    return (
        <Chip color={m.color}>
            {m.icon} {m.label}
        </Chip>
    );
};

const FindingCard = ({ finding, delay = 0 }) => {
    const [open, setOpen] = useState(false);
    const sevColor =
        finding.severity === 'critical'
            ? THEME.danger
            : finding.severity === 'warning'
              ? THEME.warning
              : finding.severity === 'info'
                ? THEME.primary
                : THEME.success;
    return (
        <Card
            accent={sevColor}
            style={{ padding: 0, overflow: 'hidden', animationDelay: `${delay}ms` }}
            className="ud-rise"
        >
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '20px 24px',
                    textAlign: 'left',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                        <SeverityBadge level={finding.severity} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain }}>{finding.title}</div>
                            <div
                                style={{ fontSize: 11, color: THEME.textDim, marginTop: 2, fontFamily: THEME.fontMono }}
                            >
                                {finding.category} · {finding.table || 'Global'}
                            </div>
                        </div>
                    </div>
                    <ChevronDown
                        size={14}
                        color={THEME.textDim}
                        style={{
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform .2s',
                            flexShrink: 0,
                        }}
                    />
                </div>
            </button>
            {open && (
                <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${THEME.glassBorder}` }}>
                    <p style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 1.7, marginTop: 12 }}>
                        {finding.description}
                    </p>
                    {finding.impact && (
                        <div
                            style={{
                                marginTop: 10,
                                padding: '20px 24px',
                                borderRadius: 20,
                                background: `${THEME.warning}0d`,
                                border: `1px solid ${THEME.warning}20`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.warning,
                                    letterSpacing: '.06em',
                                    marginBottom: 4,
                                }}
                            >
                                Impact
                            </div>
                            <p style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6 }}>{finding.impact}</p>
                        </div>
                    )}
                    {finding.recommendation && (
                        <div
                            style={{
                                marginTop: 10,
                                padding: '20px 24px',
                                borderRadius: 20,
                                background: `${THEME.success}0d`,
                                border: `1px solid ${THEME.success}20`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.success,
                                    letterSpacing: '.06em',
                                    marginBottom: 4,
                                }}
                            >
                                Recommendation
                            </div>
                            <p style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 1.6 }}>
                                {finding.recommendation}
                            </p>
                        </div>
                    )}
                    {finding.sql && (
                        <div
                            style={{
                                marginTop: 10,
                                padding: '22px 28px',
                                borderRadius: 20,
                                background: `${THEME.glassBorder}60`,
                                border: `1px solid ${THEME.glassBorder}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.cyan,
                                    letterSpacing: '.06em',
                                    marginBottom: 6,
                                }}
                            >
                                SQL Fix
                            </div>
                            <pre
                                style={{
                                    fontFamily: THEME.fontMono,
                                    fontSize: 11,
                                    color: THEME.textMuted,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    margin: 0,
                                }}
                            >
                                {finding.sql}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

const AskBox = ({ onAsk, disabled }) => {
    const [val, setVal] = useState('');
    const presets = [
        'What indexes should I add?',
        'Why is my VACUUM not running?',
        'Which tables risk data loss?',
        'Explain the HOT update issue',
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {presets.map((p, i) => (
                    <button
                        key={i}
                        onClick={() => onAsk(p)}
                        disabled={disabled}
                        className="ud-btn"
                        style={{
                            padding: '5px 12px',
                            borderRadius: 20,
                            border: `1px solid ${THEME.purple}30`,
                            background: `${THEME.purple}0d`,
                            color: THEME.purple,
                            fontSize: 11,
                            fontWeight: 600,
                        }}
                    >
                        {p}
                    </button>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
                <input
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && val.trim()) {
                            onAsk(val.trim());
                            setVal('');
                        }
                    }}
                    placeholder="Ask a follow-up question about your database…"
                    disabled={disabled}
                    style={{
                        flex: 1,
                        padding: '22px 28px',
                        borderRadius: 20,
                        border: `1px solid ${THEME.glassBorder}`,
                        background: THEME.surface,
                        color: THEME.textMain,
                        fontSize: 13,
                        fontFamily: THEME.fontMono,
                        outline: 'none',
                        transition: 'border-color .2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = `${THEME.purple}55`)}
                    onBlur={(e) => (e.target.style.borderColor = THEME.glassBorder)}
                />
                <button
                    onClick={() => {
                        if (val.trim()) {
                            onAsk(val.trim());
                            setVal('');
                        }
                    }}
                    disabled={disabled || !val.trim()}
                    className="ud-btn"
                    style={{
                        padding: '16px 22px',
                        borderRadius: 20,
                        border: 'none',
                        background: THEME.purple,
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        opacity: !val.trim() || disabled ? 0.5 : 1,
                    }}
                >
                    <Sparkles size={14} /> Ask
                </button>
            </div>
        </div>
    );
};

// ── Robust JSON extractor ──────────────────────────────────────
function extractJSON(text) {
    // Strip markdown fences
    const stripped = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    // Find the outermost { ... } block
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`No JSON object found in response. Preview: ${stripped.slice(0, 200)}`);
    }
    return JSON.parse(stripped.slice(start, end + 1));
}

function S_AIAnalysis() {
    const f = useContext(FilterCtx);
    const { data: statsData } = useTableData('/api/tables/stats');
    const { data: indexData } = useTableData('/api/tables/indexes');
    const { data: sizeData } = useTableData('/api/tables/sizes');

    const [findings, setFindings] = useState([]);
    const [summary, setSummary] = useState('');
    const [chatLog, setChatLog] = useState([]);
    const [loading, setLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('findings');
    const [score, setScore] = useState(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    const buildSnapshot = useCallback(() => {
        const tables = (statsData || []).filter((t) => matchFilter(t, f)).slice(0, 12);
        const indexes = (indexData || [])
            .filter((ix) => (!f.schema || ix.schema === f.schema) && (!f.table || ix.tableName === f.table))
            .slice(0, 20);
        const sizes = (sizeData || [])
            .filter((s) => (!f.schema || s.schema === f.schema) && (!f.table || s.name === f.table))
            .slice(0, 12);
        return {
            scope: f.table || f.schema || 'global',
            tables: tables.map((t) => ({
                name: t.name,
                schema: t.schema,
                liveRows: safeNum(t.liveRows ?? t.rows ?? 0),
                deadPct: safeNum(t.deadPct),
                seqScans: safeNum(t.seqScans),
                idxScans: safeNum(t.idxScans),
                updates: safeNum(t.updates),
                inserts: safeNum(t.inserts),
                hotPct: safeNum(t.hotPct),
            })),
            indexes: indexes.map((ix) => ({
                name: ix.name,
                table: ix.tableName,
                type: ix.type || 'btree',
                scans: safeNum(ix.scans ?? 0),
                sizeBytes: safeNum(ix.sizeBytes ?? 0),
                isPrimary: ix.isPrimary,
                isUnique: ix.isUnique,
            })),
            sizes: sizes.map((s) => ({
                name: s.name,
                schema: s.schema,
                heapBytes: safeNum(s.heapBytes),
                indexBytes: safeNum(s.indexBytes),
                toastBytes: safeNum(s.toastBytes),
                bloatPct: safeNum(s.bloatPct),
            })),
        };
    }, [statsData, indexData, sizeData, f]);

    const runAnalysis = useCallback(async () => {
        setLoading(true);
        setError(null);
        setFindings([]);
        setSummary('');
        setScore(null);
        try {
            const snapshot = buildSnapshot();
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    max_tokens: 2000,
                    system: `You are an expert PostgreSQL DBA analyst. Analyze database telemetry and return ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON.

Return this exact structure:
{
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentence executive summary>",
  "findings": [
    {
      "title": "<short finding title>",
      "severity": "<critical|warning|info|success>",
      "category": "<Performance|Bloat|Indexes|Schema|Connections|Security>",
      "table": "<table name or null>",
      "description": "<detailed explanation, 2-4 sentences>",
      "impact": "<what happens if not addressed>",
      "recommendation": "<specific actionable fix>",
      "sql": "<optional SQL fix, or null>"
    }
  ]
}

Rules:
- severity "critical" = immediate action needed
- severity "warning" = should fix soon
- severity "info" = awareness only
- severity "success" = good practice noted
- Generate 4-8 findings minimum
- SQL must be valid PostgreSQL
- Be specific with table names from the data`,
                    messages: [
                        {
                            role: 'user',
                            content: `Analyze this PostgreSQL database snapshot and return findings JSON:\n\n${JSON.stringify(snapshot, null, 2)}`,
                        },
                    ],
                }),
            });

            const apiResp = await response.json();

            // Surface API-level errors immediately
            if (apiResp.error) {
                throw new Error(apiResp.error.message || JSON.stringify(apiResp.error));
            }

            const rawText = apiResp.content?.[0]?.text || '';
            const parsed = extractJSON(rawText); // robust extraction

            setFindings(parsed.findings || []);
            setSummary(parsed.summary || '');
            setScore(parsed.overallScore ?? null);
            setChatLog([
                {
                    role: 'assistant',
                    content: `Analysis complete. Overall health score: ${parsed.overallScore}/100. ${parsed.summary}`,
                },
            ]);
        } catch (e) {
            setError(`AI analysis failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [buildSnapshot]);

    const askFollowUp = useCallback(
        async (question) => {
            if (!summary) return;
            setChatLoading(true);
            setChatLog((l) => [...l, { role: 'user', content: question }]);
            try {
                const snapshot = buildSnapshot();
                const response = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        max_tokens: 1000,
                        system: `You are an expert PostgreSQL DBA. Answer questions about the provided database telemetry. Be concise, technical, and actionable. Use plain text — no markdown headers. Include SQL examples where relevant.`,
                        messages: [
                            {
                                role: 'user',
                                content: `Database snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nPrevious analysis summary: ${summary}\n\nQuestion: ${question}`,
                            },
                        ],
                    }),
                });
                const apiResp = await response.json();
                if (apiResp.error) throw new Error(apiResp.error.message || JSON.stringify(apiResp.error));
                const text = apiResp.content?.[0]?.text || 'No response.';
                setChatLog((l) => [...l, { role: 'assistant', content: text }]);
            } catch (e) {
                setChatLog((l) => [...l, { role: 'assistant', content: `Error: ${e.message}` }]);
            } finally {
                setChatLoading(false);
            }
        },
        [summary, buildSnapshot],
    );

    const criticals = findings.filter((f) => f.severity === 'critical').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    const scoreColor =
        score === null ? THEME.textDim : score >= 75 ? THEME.success : score >= 50 ? THEME.warning : THEME.danger;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecHead
                Icon={BrainCircuit}
                accent={THEME.purple}
                title="AI Deep Analysis"
                sub="Groq-powered PostgreSQL diagnostics with actionable findings and follow-up Q&A"
                right={
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                        {score !== null && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 14px',
                                    borderRadius: 20,
                                    background: `${scoreColor}15`,
                                    border: `1px solid ${scoreColor}30`,
                                }}
                            >
                                <span style={{ fontSize: 10, color: THEME.textDim, fontFamily: THEME.fontMono }}>
                                    Health
                                </span>
                                <span
                                    style={{
                                        fontSize: 16,
                                        fontWeight: 800,
                                        color: scoreColor,
                                        fontFamily: THEME.fontMono,
                                    }}
                                >
                                    {score}
                                </span>
                            </div>
                        )}
                        <button
                            onClick={runAnalysis}
                            disabled={loading}
                            className="ud-btn ai-glow"
                            style={{
                                padding: '9px 18px',
                                borderRadius: 20,
                                border: `1px solid ${THEME.purple}40`,
                                background: loading
                                    ? `${THEME.purple}15`
                                    : `linear-gradient(135deg, ${THEME.purple}25, ${THEME.purple}10)`,
                                color: THEME.purple,
                                fontSize: 13,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? (
                                <>
                                    <div
                                        style={{
                                            width: 13,
                                            height: 13,
                                            borderRadius: '50%',
                                            border: `2px solid ${THEME.purple}40`,
                                            borderTopColor: THEME.purple,
                                            animation: 'ud-spin 1s linear infinite',
                                        }}
                                    />{' '}
                                    Analyzing…
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} /> {findings.length > 0 ? 'Re-analyze' : 'Run AI Analysis'}
                                </>
                            )}
                        </button>
                    </div>
                }
            />

            {/* Idle state */}
            {!loading && findings.length === 0 && !error && (
                <Card
                    className="ai-glow"
                    style={{
                        padding: 48,
                        textAlign: 'center',
                        border: `1px dashed ${THEME.purple}40`,
                        background: `${THEME.purple}05`,
                    }}
                >
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                        AI-Powered Database Analysis
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            color: THEME.textDim,
                            maxWidth: 480,
                            margin: '0 auto',
                            lineHeight: 1.7,
                            marginBottom: 24,
                        }}
                    >
                        Claude will analyze your live database telemetry — including table health, index efficiency,
                        bloat, write patterns, and more — then generate prioritized findings with SQL fixes.
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            flexWrap: 'wrap',
                            gap: 22,
                            marginBottom: 28,
                        }}
                    >
                        {[
                            'Dead tuple analysis',
                            'Index efficiency',
                            'Write amplification',
                            'VACUUM scheduling',
                            'Bloat estimation',
                            'Schema risks',
                        ].map((feat, i) => (
                            <div
                                key={i}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: 20,
                                    background: `${THEME.purple}10`,
                                    border: `1px solid ${THEME.purple}20`,
                                    fontSize: 11,
                                    color: THEME.purple,
                                    fontFamily: THEME.fontMono,
                                }}
                            >
                                {feat}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={runAnalysis}
                        className="ud-btn"
                        style={{
                            padding: '12px 28px',
                            borderRadius: 16,
                            border: 'none',
                            background: `linear-gradient(135deg, ${THEME.purple}, ${THEME.primary})`,
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 20,
                        }}
                    >
                        <Sparkles size={16} /> Run Deep Analysis
                    </button>
                </Card>
            )}

            {/* Loading shimmer */}
            {loading && (
                <Card style={{ padding: 32, border: `1px solid ${THEME.purple}30` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                border: `2px solid ${THEME.purple}30`,
                                borderTopColor: THEME.purple,
                                animation: 'ud-spin 1s linear infinite',
                                flexShrink: 0,
                            }}
                        />
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>
                                Running deep analysis…
                            </div>
                            <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 3 }}>
                                Claude is examining table stats, indexes, write patterns, and bloat data
                            </div>
                        </div>
                    </div>
                    {[
                        'Scanning table health metrics',
                        'Analysing index usage patterns',
                        'Computing write amplification',
                        'Evaluating bloat thresholds',
                        'Generating prioritized findings',
                    ].map((step, i) => (
                        <div
                            key={i}
                            className="ai-thinking"
                            style={{
                                height: 14,
                                borderRadius: 18,
                                marginBottom: 8,
                                width: `${60 + i * 7}%`,
                                opacity: 0.7,
                            }}
                        />
                    ))}
                </Card>
            )}

            {error && <ErrUI msg={error} />}

            {/* Results */}
            {!loading && findings.length > 0 && (
                <>
                    {summary && (
                        <Card
                            style={{
                                padding: '22px 28px',
                                borderLeft: `3px solid ${THEME.purple}`,
                                background: `${THEME.purple}06`,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: 22,
                                }}
                            >
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: THEME.purple,
                                            letterSpacing: '.07em',
                                            fontFamily: THEME.fontMono,
                                            marginBottom: 6,
                                        }}
                                    >
                                        Executive Summary
                                    </div>
                                    <p style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 1.7 }}>{summary}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
                                    {criticals > 0 && <Chip color={THEME.danger}>{criticals} critical</Chip>}
                                    {warnings > 0 && <Chip color={THEME.warning}>{warnings} warnings</Chip>}
                                    <Chip color={THEME.success}>
                                        {findings.filter((f) => f.severity === 'success').length} healthy
                                    </Chip>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div
                        style={{
                            display: 'flex',
                            gap: 4,
                            padding: 3,
                            borderRadius: 16,
                            background: `${THEME.glassBorder}60`,
                            width: 'fit-content',
                        }}
                    >
                        {[
                            { id: 'findings', label: `Findings (${findings.length})`, Icon: AlertCircle },
                            { id: 'chat', label: 'Ask Claude', Icon: MessageSquare },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: 20,
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: activeTab === tab.id ? THEME.surface : 'transparent',
                                    color: activeTab === tab.id ? THEME.textMain : THEME.textDim,
                                    fontWeight: activeTab === tab.id ? 700 : 500,
                                    fontSize: 12,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,.2)' : 'none',
                                    transition: 'all .16s',
                                }}
                            >
                                <tab.Icon size={13} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'findings' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            {['critical', 'warning', 'info', 'success'].map((sev) => {
                                const group = findings.filter((f) => f.severity === sev);
                                if (!group.length) return null;
                                const sevColor =
                                    sev === 'critical'
                                        ? THEME.danger
                                        : sev === 'warning'
                                          ? THEME.warning
                                          : sev === 'info'
                                            ? THEME.primary
                                            : THEME.success;
                                return (
                                    <div key={sev}>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 20,
                                                marginBottom: 8,
                                                marginTop: 4,
                                            }}
                                        >
                                            <div style={{ height: 1, flex: 1, background: `${sevColor}25` }} />
                                            <SeverityBadge level={sev} />
                                            <div style={{ height: 1, flex: 1, background: `${sevColor}25` }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                            {group.map((finding, i) => (
                                                <FindingCard key={i} finding={finding} delay={i * 50} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        maxHeight: 400,
                                        overflowY: 'auto',
                                        padding: '22px 26px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 18,
                                    }}
                                >
                                    {chatLog.map((msg, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                gap: 22,
                                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    flexShrink: 0,
                                                    background:
                                                        msg.role === 'user'
                                                            ? `${THEME.primary}30`
                                                            : `${THEME.purple}30`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 13,
                                                }}
                                            >
                                                {msg.role === 'user' ? '👤' : '🧠'}
                                            </div>
                                            <div
                                                style={{
                                                    maxWidth: '78%',
                                                    padding: '22px 28px',
                                                    borderRadius:
                                                        msg.role === 'user'
                                                            ? '14px 2px 14px 14px'
                                                            : '2px 14px 14px 14px',
                                                    background:
                                                        msg.role === 'user'
                                                            ? `${THEME.primary}15`
                                                            : `${THEME.purple}10`,
                                                    border: `1px solid ${msg.role === 'user' ? THEME.primary : THEME.purple}25`,
                                                    fontSize: 13,
                                                    color: THEME.textMuted,
                                                    lineHeight: 1.7,
                                                    fontFamily: msg.role === 'assistant' ? 'inherit' : THEME.fontMono,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {chatLoading && (
                                        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-end' }}>
                                            <div
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    background: `${THEME.purple}30`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: 13,
                                                }}
                                            >
                                                🧠
                                            </div>
                                            <div
                                                style={{
                                                    padding: '18px 22px',
                                                    borderRadius: '2px 14px 14px 14px',
                                                    background: `${THEME.purple}10`,
                                                    border: `1px solid ${THEME.purple}25`,
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                                    {[0, 1, 2].map((j) => (
                                                        <div
                                                            key={j}
                                                            style={{
                                                                width: 6,
                                                                height: 6,
                                                                borderRadius: '50%',
                                                                background: THEME.purple,
                                                                animation: `ud-pulse 1.2s ease ${j * 0.2}s infinite`,
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>
                            </Card>
                            <AskBox onAsk={askFollowUp} disabled={chatLoading} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────
   NAV REGISTRY
───────────────────────────────────────────────────────────────── */
const GROUPS = [
    {
        id: 'health',
        label: 'Health',
        Icon: Activity,
        color: () => THEME.success,
        items: [
            {
                id: 'scorecard',
                label: 'Health Scorecard',
                Icon: Activity,
                sub: 'VACUUM & health rings',
                component: S_Health,
            },
            {
                id: 'activity',
                label: 'Activity Heatmap',
                Icon: BarChart2,
                sub: 'Scans & DML rates',
                component: S_Activity,
            },
            {
                id: 'forecast',
                label: 'Forecast',
                Icon: TrendingUp,
                sub: 'Dead tuple projection',
                component: S_Forecast,
            },
            { id: 'rows', label: 'Row Counts', Icon: Database, sub: 'Live vs dead tuples', component: S_RowCounts },
            {
                id: 'autovacuum',
                label: 'Autovacuum',
                Icon: RefreshCw,
                sub: 'Daemon run tracker',
                component: S_Autovacuum,
            },
        ],
    },
    {
        id: 'diagnostics',
        label: 'Diagnostics',
        Icon: Search,
        color: () => THEME.warning,
        items: [
            {
                id: 'columns',
                label: 'Column Stats',
                Icon: Search,
                sub: 'Null % & distinct values',
                component: S_Columns,
            },
            { id: 'toast', label: 'TOAST Bloat', Icon: Layers, sub: 'Oversized columns', component: S_Toast },
            {
                id: 'temp',
                label: 'Temp Tables',
                Icon: Clock,
                sub: 'Session temp usage',
                component: S_Temp,
                hideWhenTable: true,
            },
            { id: 'queryPerf', label: 'Query Perf', Icon: FileText, sub: 'pg_stat_statements', component: S_QueryPerf },
            { id: 'locks', label: 'Lock Monitor', Icon: Lock, sub: 'Blocking chains & deadlocks', component: S_Locks },
            {
                id: 'conns',
                label: 'Connections',
                Icon: Users,
                sub: 'Pool & pg_stat_activity',
                component: S_Connections,
                hideWhenTable: true,
            },
        ],
    },
    {
        id: 'architecture',
        label: 'Architecture',
        Icon: Zap,
        color: () => THEME.cyan,
        items: [
            { id: 'schema', label: 'Schema History', Icon: HardDrive, sub: 'DDL timeline', component: S_Schema },
            { id: 'deps', label: 'Dependencies', Icon: Zap, sub: 'FK chains & cascades', component: S_Deps },
            { id: 'write', label: 'Write Amp', Icon: Shield, sub: 'HOT updates & WAL', component: S_Write },
        ],
    },
    {
        id: 'table',
        label: 'Table Details',
        Icon: Eye,
        color: () => THEME.primary,
        tableOnly: true,
        items: [
            {
                id: 'indexes',
                label: 'Index Analysis',
                Icon: Eye,
                sub: 'Usage & unused detection',
                component: S_Indexes,
                tableOnly: true,
            },
            {
                id: 'sizes',
                label: 'Size Breakdown',
                Icon: Cpu,
                sub: 'Heap / index / TOAST',
                component: S_Sizes,
                tableOnly: true,
            },
        ],
    },
    {
        id: 'ai',
        label: 'AI Intelligence',
        Icon: BrainCircuit,
        color: () => THEME.purple,
        items: [
            {
                id: 'ai-analysis',
                label: 'AI Deep Analysis',
                Icon: BrainCircuit,
                sub: 'Claude-powered diagnostics',
                component: S_AIAnalysis,
            },
        ],
    },
];

/* ─────────────────────────────────────────────────────────────────
   LIVE CLOCK
───────────────────────────────────────────────────────────────── */
const LiveClock = React.memo(function LiveClock() {
    const [tick, setTick] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setTick(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <span style={{ fontFamily: THEME.fontMono, fontSize: 10, color: THEME.textDim }}>
            {tick.toTimeString().slice(0, 8)}
        </span>
    );
});

/* ─────────────────────────────────────────────────────────────────
   MAIN SHELL
───────────────────────────────────────────────────────────────── */
export default function UnifiedDashboard() {
    useAdaptiveTheme();
    const [filter, setFilter] = useState({ db: '', schema: '', table: '' });
    const [activeId, setActiveId] = useState('scorecard');
    const [collapsed, setCollapsed] = useState({});

    const { data: allTables } = useTableData('/api/tables/stats');
    const { data: dbRaw } = useTableData('/api/databases');

    const handleFilter = useCallback((v) => {
        setFilter((p) => (typeof v === 'function' ? v(p) : v));
        setActiveId('scorecard');
    }, []);

    const visibleGroups = GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((s) => {
            if (s.tableOnly) return !!filter.table;
            if (s.hideWhenTable) return !filter.table;
            return true;
        }),
    })).filter((g) => (!g.tableOnly || !!filter.table) && g.items.length > 0);

    const allItems = visibleGroups.flatMap((g) => g.items);
    const activeItem = allItems.find((s) => s.id === activeId) || allItems[0];
    const Preview = activeItem?.component;
    const activeGroup = visibleGroups.find((g) => g.items.some((s) => s.id === activeItem?.id));

    return (
        <FilterCtx.Provider value={filter}>
            <style>{CSS}</style>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    width: '100%',
                    fontFamily: THEME.fontBody,
                    color: THEME.textMain,
                    overflow: 'hidden',
                }}
            >
                {/* ── TOP BAR: Group tabs ── */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 24px',
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        background: THEME.surface,
                        flexShrink: 0,
                        gap: 22,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'auto' }}>
                        {visibleGroups.map((g) => {
                            const isActive = activeGroup?.id === g.id;
                            const gColor = g.color();
                            return (
                                <button
                                    key={g.id}
                                    className={`ud-group-tab ${isActive ? 'active' : ''}`}
                                    onClick={() => setActiveId(g.items[0].id)}
                                    style={
                                        isActive
                                            ? { background: `${gColor}10`, color: gColor, borderColor: `${gColor}25` }
                                            : {}
                                    }
                                >
                                    <g.Icon size={13} />
                                    {g.label}
                                    {g.id === 'ai' && (
                                        <span
                                            style={{
                                                fontSize: 8,
                                                fontWeight: 700,
                                                color: THEME.purple,
                                                background: `${THEME.purple}20`,
                                                padding: '1px 5px',
                                                borderRadius: 16,
                                            }}
                                        >
                                            AI
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {filter.table && (
                            <Chip color={THEME.success} size="sm">
                                {filter.table}
                            </Chip>
                        )}
                        {filter.schema && !filter.table && (
                            <Chip color={THEME.primary} size="sm">
                                {filter.schema}
                            </Chip>
                        )}
                    </div>
                </div>

                {/* ── SUB-NAV: Section tabs for active group ── */}
                {activeGroup && activeGroup.items.length > 1 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '8px 24px',
                            background: `${THEME.surface}80`,
                            borderBottom: `1px solid ${THEME.glassBorder}80`,
                            flexShrink: 0,
                            overflowX: 'auto',
                        }}
                    >
                        {activeGroup.items.map((s) => {
                            const isActive = activeItem?.id === s.id;
                            return (
                                <button
                                    key={s.id}
                                    className={`ud-sub-tab ${isActive ? 'active' : ''}`}
                                    onClick={() => setActiveId(s.id)}
                                >
                                    <s.Icon size={12} />
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ── MAIN CONTENT ── */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '20px 24px 32px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 22,
                    }}
                >
                    <FilterBar filter={filter} setFilter={handleFilter} allTables={allTables} dbRaw={dbRaw} />

                    <div
                        key={`${activeItem?.id}-${filter.db}-${filter.schema}-${filter.table}`}
                        className="ud-rise"
                        style={{
                            background: THEME.surface,
                            border: `1px solid ${THEME.glassBorder}`,
                            borderRadius: 20,
                            padding: 22,
                            minHeight: 280,
                        }}
                    >
                        {Preview && <Preview />}
                    </div>
                </div>
            </div>
        </FilterCtx.Provider>
    );
}
