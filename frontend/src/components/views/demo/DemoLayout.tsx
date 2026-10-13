import React, { useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import { useNavigation } from '../../../context/NavigationContext';
import {
    PanelCard as TremorPanelCard,
    StatusBadge as TremorStatusBadge,
    RingGauge as TremorRingGauge,
} from '../../ui/tremor';
import { ChevronDown, ArrowUpRight, ArrowDownRight, Bell, User, Search, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import DemoDatabasePicker, { DemoOverviewSummary, DEMO_DB_OPTIONS } from './DemoDatabasePicker';

/* ═══════════════════════════════════════════════════════════════════════════
   DemoLayout — rewritten to match the main PulseDB app's look & feel.

   Now uses:
     • THEME adaptive tokens (works in both light and dark mode, same as the
       rest of the app), instead of the previous hardcoded light-only palette.
     • Shared ui/tremor components (PanelCard, StatusBadge, RingGauge) for
       the building blocks the main monitoring tabs already use.
     • Main-app visual grammar: 16px radii, THEME.glassBorder, THEME.shadowSm,
       2px accent strip at the top of panels, uppercase 11px KPI labels.

   The public API and the exported helper components stay identical so the
   13 engine demo tabs and DemoEngineTab keep working without changes:

   Props:
     sections, renderContent, children, title, subtitle, connectionBarMeta,
     accentColor, titleIcon, headerStats, clusterOptions, statusItems,
     onRefresh, onExport, activeDemo

   Re-exported sub-components (consumed by every engine tab):
     Panel, StatusBadge, RingGauge, MiniSparkline, HeroMetric, MetricCard,
     LiveMetric, TabPills, AlertRow, DataTable, ChartTip, ConnectionBar,
     generateChartData, ExecStatCard
   ═══════════════════════════════════════════════════════════════════════════ */

const SIDEBAR_W = 240;
const SIDEBAR_W_COLLAPSED = 48;

/* Live demo KPIs shown in the header bar — cycles every 4s to feel alive */
const DEMO_HEADER_KPIS = [
    { label: 'QPS', values: ['1,247', '1,312', '1,189', '1,401'], color: THEME.primary },
    { label: 'Cache Hit', values: ['99.2%', '99.1%', '99.4%', '99.0%'], color: THEME.success },
    { label: 'Conns', values: ['42', '45', '41', '47'], color: THEME.warning },
    { label: 'Avg Lat', values: ['1.2ms', '1.4ms', '1.1ms', '1.6ms'], color: THEME.aiDark },
];

/* DEMO_TABS moved to ./DemoDatabasePicker.tsx (exported as DEMO_DB_OPTIONS)
   which holds richer metadata — category, status, vendor, accent color. */

interface DemoLayoutProps {
    sections?: any[];
    renderContent?: any;
    children?: any;
    title?: any;
    subtitle?: any;
    connectionBarMeta?: any;
    accentColor?: any;
    titleIcon?: any;
    headerStats?: any[];
    clusterOptions?: string[];
    statusItems?: any[];
    onRefresh?: any;
    onExport?: any;
    activeDemo?: any;
}

const DemoLayout: React.FC<DemoLayoutProps> = ({
    sections = [],
    renderContent,
    children,
    title,
    subtitle,
    connectionBarMeta,
    accentColor,
    titleIcon: TitleIcon,
    headerStats = [],
    clusterOptions = ['Local Dev'],
    statusItems = [],
    onRefresh,
    onExport,
    activeDemo: propActiveDemo,
}) => {
    void subtitle;
    void connectionBarMeta;

    useAdaptiveTheme();

    const activeDemo = propActiveDemo || (() => {
        try {
            const t = localStorage.getItem('pulsedb_active_tab') || '';
            return t.startsWith('demo-') ? t : 'demo-postgres';
        } catch {
            return 'demo-postgres';
        }
    })();

    let goToTab: any = null;
    try {
        const nav = useNavigation();
        goToTab = nav?.goToTab;
    } catch {
        /* outside NavigationContext */
    }

    const [activeSection, setActiveSection] = useState(sections[0]?.key || '');
    const [activeItem, setActiveItem] = useState(sections[0]?.items?.[0]?.key || '');
    const [openSections, setOpenSections] = useState(() => new Set(sections.map((s: any) => s.key)));
    /* activeCluster state removed along with the cluster dropdown. */
    void clusterOptions;

    /* Comparison mode — when on, the picker shows a second dropdown and
       the overview summary renders the two databases side-by-side. */
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [compareId, setCompareId] = useState<string | null>(null);

    /* Sidebar nav search — filters section items live by label/key. */
    const [navSearch, setNavSearch] = useState('');
    /* Demo sidebar collapse — lets users get more content width */
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    /* Live header KPI ticker */
    const [kpiTick, setKpiTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setKpiTick((n) => n + 1), 4000);
        return () => clearInterval(t);
    }, []);
    /* Default the compare target to the next database in the list, so a
       fresh toggle produces a sensible side-by-side instead of an empty slot. */
    React.useEffect(() => {
        if (compareEnabled && !compareId) {
            const next = DEMO_DB_OPTIONS.find((o) => o.id !== activeDemo);
            if (next) setCompareId(next.id);
        }
    }, [compareEnabled, compareId, activeDemo]);

    const toggleSection = (key: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const handleItemClick = (sectionKey: string, itemKey: string) => {
        setActiveSection(sectionKey);
        setActiveItem(itemKey);
        if (!openSections.has(sectionKey)) {
            setOpenSections((prev) => new Set(prev).add(sectionKey));
        }
    };

    const activeItemData = sections
        .find((s: any) => s.key === activeSection)
        ?.items?.find((i: any) => i.key === activeItem);

    const primary = accentColor || THEME.primary;

    return (
        <div
            style={{
                display: 'flex',
                height: '100%',
                minHeight: '100vh',
                position: 'relative',
                background: THEME.bg,
                flexDirection: 'column',
            }}
        >
            <DemoStyles />

            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* ── SIDEBAR ── */}
                <aside
                    style={{
                        width: sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W,
                        minWidth: sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W,
                        background: THEME.surface,
                        borderRight: `1px solid ${THEME.glassBorder}`,
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: sidebarCollapsed ? 'hidden' : 'auto',
                        overflowX: 'hidden',
                        position: 'sticky',
                        top: 0,
                        alignSelf: 'flex-start',
                        height: '100vh',
                        zIndex: 2,
                        boxShadow: THEME.shadowSm,
                        transition: 'width 0.2s ease, min-width 0.2s ease',
                    }}
                >
                    {/* Logo + title + demo switcher */}
                    <div
                        style={{
                            padding: sidebarCollapsed ? '14px 8px' : '18px 18px 14px',
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            flexShrink: 0,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sidebarCollapsed ? 0 : 12 }}>
                            {goToTab && (
                                <button
                                    onClick={() => goToTab('connections')}
                                    title="Back to main menu"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 8,
                                        border: `1px solid ${THEME.glassBorder}`,
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        padding: 0,
                                        fontSize: 14,
                                        color: THEME.textMuted,
                                        transition: THEME.transitionFast,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = THEME.surfaceHover;
                                        e.currentTarget.style.color = THEME.textMain;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = THEME.textMuted;
                                    }}
                                >
                                    ←
                                </button>
                            )}
                            {TitleIcon && (
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: `${primary}12`,
                                        flexShrink: 0,
                                    }}
                                >
                                    <TitleIcon size={16} color={primary} strokeWidth={2} />
                                </div>
                            )}
                            {!sidebarCollapsed && (
                                <span
                                    style={{
                                        fontSize: 13.5,
                                        fontWeight: 650,
                                        color: THEME.textMain,
                                        fontFamily: THEME.fontBody,
                                        letterSpacing: '-0.01em',
                                        flex: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {title}
                                </span>
                            )}
                            {/* Sidebar collapse toggle */}
                            <button
                                onClick={() => setSidebarCollapsed((v) => !v)}
                                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 7,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    padding: 0,
                                    color: THEME.textDim,
                                    transition: THEME.transitionFast,
                                    marginLeft: 'auto',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = THEME.surfaceHover;
                                    e.currentTarget.style.color = THEME.textMain;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = THEME.textDim;
                                }}
                            >
                                {sidebarCollapsed
                                    ? <PanelLeftOpen size={13} />
                                    : <PanelLeftClose size={13} />
                                }
                            </button>
                        </div>

                        {/* Database picker — searchable dropdown w/ status dots,
                            category filters, and an optional compare toggle. */}
                        {!sidebarCollapsed && <DemoDatabasePicker
                            activeId={activeDemo}
                            onChange={(id) => goToTab && goToTab(id)}
                            compareEnabled={compareEnabled}
                            compareId={compareId}
                            onCompareToggle={(v) => {
                                setCompareEnabled(v);
                                if (!v) setCompareId(null);
                            }}
                            onCompareChange={(id) => setCompareId(id)}
                        />}
                    </div>

                    {/* Active-cluster dropdown removed — the picker above already
                        communicates the selected database; cluster selection is
                        not needed inside the demo. */}

                    {/* Sidebar nav search — filters the section items below. */}
                    {sections.length > 0 && !sidebarCollapsed && (
                        <div
                            style={{
                                padding: '10px 14px 6px',
                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                flexShrink: 0,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '5px 8px',
                                    background: THEME.surfaceHover,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: 8,
                                }}
                            >
                                <Search size={11} color={THEME.textDim} />
                                <input
                                    value={navSearch}
                                    onChange={(e) => setNavSearch(e.target.value)}
                                    placeholder="Search metrics…"
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        outline: 'none',
                                        background: 'transparent',
                                        color: THEME.textMain,
                                        fontSize: 11.5,
                                        fontFamily: THEME.fontBody,
                                        minWidth: 0,
                                    }}
                                />
                                {navSearch && (
                                    <button
                                        onClick={() => setNavSearch('')}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: THEME.textDim,
                                            display: 'flex',
                                            padding: 0,
                                        }}
                                    >
                                        <X size={11} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Nav sections */}
                    <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
                        {sections.map((section: any, si: number) => {
                            const isOpen = openSections.has(section.key);
                            const SIcon = section.icon;
                            const sAccent = section.accent || primary;
                            const itemCount = (section.items || []).length;
                            const hasActiveItem = activeSection === section.key;

                            /* In collapsed sidebar: show only an icon button per section */
                            if (sidebarCollapsed) {
                                return (
                                    <button
                                        key={section.key}
                                        onClick={() => {
                                            setSidebarCollapsed(false);
                                            if (section.items?.[0]) handleItemClick(section.key, section.items[0].key);
                                        }}
                                        title={section.label}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '8px 0',
                                            background: hasActiveItem ? `${sAccent}15` : 'transparent',
                                            border: 'none',
                                            borderLeft: hasActiveItem ? `2px solid ${sAccent}` : '2px solid transparent',
                                            cursor: 'pointer',
                                            color: hasActiveItem ? sAccent : THEME.textDim,
                                            transition: THEME.transitionFast,
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = THEME.surfaceHover;
                                            e.currentTarget.style.color = THEME.textMain;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = hasActiveItem ? `${sAccent}15` : 'transparent';
                                            e.currentTarget.style.color = hasActiveItem ? sAccent : THEME.textDim;
                                        }}
                                    >
                                        {SIcon ? <SIcon size={14} /> : <span style={{ fontSize: 10, fontWeight: 700 }}>{section.label?.[0]}</span>}
                                    </button>
                                );
                            }

                            return (
                                <div key={section.key} style={{ marginBottom: 2 }}>
                                    <button
                                        onClick={() => toggleSection(section.key)}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '7px 14px 5px',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            marginTop: si === 0 ? 2 : 6,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: 9.5,
                                                fontWeight: 700,
                                                letterSpacing: '0.08em',
                                                textTransform: 'uppercase',
                                                fontFamily: THEME.fontMono,
                                                color: THEME.textDim,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {SIcon && <SIcon size={11} />}
                                            {section.label}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            {!isOpen && itemCount > 0 && (
                                                <span style={{
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: THEME.textDim,
                                                    background: THEME.surfaceHover,
                                                    borderRadius: 10,
                                                    padding: '1px 5px',
                                                    fontFamily: THEME.fontMono,
                                                }}>
                                                    {itemCount}
                                                </span>
                                            )}
                                            <ChevronDown
                                                size={12}
                                                color={THEME.textDim}
                                                style={{
                                                    transition: 'transform 0.2s ease',
                                                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div>
                                            {(section.items || [])
                                                .filter((item: any) => {
                                                    const q = navSearch.trim().toLowerCase();
                                                    if (!q) return true;
                                                    return (
                                                        String(item.label || '').toLowerCase().includes(q) ||
                                                        String(item.key || '').toLowerCase().includes(q)
                                                    );
                                                })
                                                .map((item: any) => {
                                                const isActive =
                                                    activeSection === section.key && activeItem === item.key;
                                                const IIcon = item.icon;
                                                return (
                                                    <button
                                                        key={item.key}
                                                        onClick={() => handleItemClick(section.key, item.key)}
                                                        className="demo-nav-item"
                                                        style={{
                                                            width: '100%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 10,
                                                            padding: '7px 14px 7px 26px',
                                                            background: isActive
                                                                ? `${sAccent}12`
                                                                : 'transparent',
                                                            border: 'none',
                                                            borderLeft: isActive
                                                                ? `2px solid ${sAccent}`
                                                                : `2px solid transparent`,
                                                            cursor: 'pointer',
                                                            color: isActive ? sAccent : THEME.textMuted,
                                                            fontWeight: isActive ? 650 : 500,
                                                            fontSize: 12,
                                                            textAlign: 'left',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            fontFamily: THEME.fontBody,
                                                            transition: THEME.transitionFast,
                                                            position: 'relative',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (!isActive) {
                                                                e.currentTarget.style.background =
                                                                    THEME.surfaceHover;
                                                                e.currentTarget.style.color = THEME.textMain;
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isActive) {
                                                                e.currentTarget.style.background =
                                                                    'transparent';
                                                                e.currentTarget.style.color =
                                                                    THEME.textMuted;
                                                            }
                                                        }}
                                                    >
                                                        {IIcon && (
                                                            <IIcon
                                                                size={13}
                                                                style={{
                                                                    flexShrink: 0,
                                                                    opacity: isActive ? 1 : 0.7,
                                                                }}
                                                            />
                                                        )}
                                                        <span
                                                            style={{
                                                                flex: 1,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}
                                                        >
                                                            {item.label}
                                                        </span>
                                                        {item.badge && (
                                                            <span
                                                                style={{
                                                                    fontSize: 8.5,
                                                                    fontWeight: 700,
                                                                    background: `${sAccent}18`,
                                                                    color: sAccent,
                                                                    borderRadius: 6,
                                                                    padding: '1px 6px',
                                                                    flexShrink: 0,
                                                                    fontFamily: THEME.fontMono,
                                                                    letterSpacing: '0.02em',
                                                                }}
                                                            >
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Sidebar bottom buttons */}
                    <div
                        style={{
                            padding: '12px 10px',
                            borderTop: `1px solid ${THEME.glassBorder}`,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                        }}
                    >
                        <button
                            onClick={onRefresh}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 8,
                                border: `1px solid ${THEME.glassBorder}`,
                                background: 'transparent',
                                color: THEME.textMuted,
                                cursor: onRefresh ? 'pointer' : 'not-allowed',
                                fontFamily: THEME.fontBody,
                                transition: THEME.transitionBase,
                            }}
                            onMouseEnter={(e) => {
                                if (onRefresh) {
                                    e.currentTarget.style.background = THEME.surfaceHover;
                                    e.currentTarget.style.color = THEME.textMain;
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = THEME.textMuted;
                            }}
                        >
                            Refresh data
                        </button>
                        {activeDemo === 'demo-mongodb' && (
                            <>
                                <button
                                    onClick={onExport}
                                    style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        borderRadius: 8,
                                        border: `1px solid ${THEME.glassBorder}`,
                                        background: 'transparent',
                                        color: THEME.textMuted,
                                        cursor: onExport ? 'pointer' : 'not-allowed',
                                        fontFamily: THEME.fontBody,
                                        transition: THEME.transitionBase,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (onExport) {
                                            e.currentTarget.style.background = THEME.surfaceHover;
                                            e.currentTarget.style.color = THEME.textMain;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = THEME.textMuted;
                                    }}
                                >
                                    Export JSON
                                </button>
                                <button
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        borderRadius: 8,
                                        border: 'none',
                                        background: primary,
                                        color: '#ffffff',
                                        cursor: 'pointer',
                                        fontFamily: THEME.fontBody,
                                        transition: THEME.transitionBase,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = '0.9';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = '1';
                                    }}
                                >
                                    + Add cluster
                                </button>
                            </>
                        )}
                    </div>
                </aside>

                {/* ── CONTENT COLUMN ── */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    {/* Top header bar */}
                    <header
                        style={{
                            height: 56,
                            background: THEME.glass,
                            borderBottom: `1px solid ${THEME.glassBorder}`,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 20px',
                            gap: 24,
                            position: 'relative',
                            zIndex: 10,
                            flexShrink: 0,
                            backdropFilter: 'saturate(180%) blur(10px)',
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: THEME.textDim,
                                    fontFamily: THEME.fontMono,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    marginBottom: 2,
                                }}
                            >
                                {title}{' '}
                                {activeSection && (
                                    <span style={{ color: THEME.textMuted }}>
                                        &gt; {sections.find((s: any) => s.key === activeSection)?.label}
                                    </span>
                                )}
                            </div>
                            <div
                                style={{
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: THEME.textMain,
                                    fontFamily: THEME.fontBody,
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                {activeItemData?.label ||
                                    sections.find((s: any) => s.key === activeSection)?.label ||
                                    'Dashboard'}
                            </div>
                        </div>

                        {/* Right: live KPI ticker + stats + live + bell + avatar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                            {/* Always-visible live KPI chips */}
                            <div style={{ display: 'flex', gap: 6 }}>
                                {DEMO_HEADER_KPIS.map((kpi, i) => {
                                    const val = kpi.values[(kpiTick + i) % kpi.values.length];
                                    return (
                                        <div key={kpi.label} style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '4px 10px',
                                            background: `${kpi.color}10`,
                                            borderRadius: 8,
                                            border: `1px solid ${kpi.color}22`,
                                            minWidth: 48,
                                        }}>
                                            <div style={{ fontSize: 11.5, fontWeight: 700, color: kpi.color, fontFamily: THEME.fontMono, lineHeight: 1 }}>
                                                {val}
                                            </div>
                                            <div style={{ fontSize: 8.5, color: THEME.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                                                {kpi.label}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {headerStats && headerStats.length > 0 && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {headerStats.map((stat: any, i: number) => (
                                        <div
                                            key={i}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                padding: '6px 12px',
                                                background: `${stat.color || primary}12`,
                                                borderRadius: 10,
                                                border: `1px solid ${stat.color || primary}28`,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: stat.color || primary,
                                                    fontFamily: THEME.fontMono,
                                                }}
                                            >
                                                {stat.value}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 8,
                                                    color: THEME.textDim,
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.06em',
                                                    marginTop: 1,
                                                }}
                                            >
                                                {stat.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 10px',
                                    background: `${THEME.success}12`,
                                    borderRadius: 10,
                                    border: `1px solid ${THEME.success}30`,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: THEME.success,
                                    fontFamily: THEME.fontMono,
                                    letterSpacing: '0.04em',
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: THEME.success,
                                        animation: 'live-pulse 1.5s ease-in-out infinite',
                                    }}
                                />
                                LIVE
                            </div>

                            <button
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: THEME.surfaceHover,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: THEME.transitionFast,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = THEME.surfaceRaised;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = THEME.surfaceHover;
                                }}
                            >
                                <Bell size={16} color={THEME.textDim} />
                            </button>

                            <button
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: primary,
                                    border: `1px solid ${THEME.glassBorder}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: THEME.transitionFast,
                                }}
                            >
                                <User size={16} color="#ffffff" />
                            </button>
                        </div>
                    </header>

                    {/* Main content */}
                    <main
                        style={{
                            flex: 1,
                            minHeight: 0,
                            minWidth: 0,
                            padding: '20px 22px 56px', /* 56px = 24px footer + 32px comfortable bottom margin */
                            overflowY: 'auto',
                            position: 'relative',
                            zIndex: 5,
                        }}
                    >
                        {/* Live-feel summary strip — only rendered on the Fleet
                            Overview item of the "sections"-style demo tabs
                            (PostgreSQL, MySQL, MongoDB). The bespoke "Full" tabs
                            (SQL Server, Oracle, Redis, etc.) render their own
                            rich overview via `children`, so we don't inject the
                            strip there — it would just duplicate / push content
                            off-screen. */}
                        {sections.length > 0 &&
                            activeSection === 'overview' &&
                            (activeItem === 'fleet-overview' ||
                                activeItem === 'fleet' ||
                                activeItem === 'overview') && (
                                <DemoOverviewSummary
                                    activeId={activeDemo}
                                    compareId={compareEnabled ? compareId : null}
                                />
                            )}
                        {typeof renderContent === 'function'
                            ? renderContent(activeSection, activeItem)
                            : children}
                    </main>
                </div>

                {/* Bottom status bar */}
                <footer
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 24,
                        background: THEME.glass,
                        borderTop: `1px solid ${THEME.glassBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: (sidebarCollapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W) + 16,
                        paddingRight: 20,
                        gap: 18,
                        fontSize: 10,
                        fontFamily: THEME.fontMono,
                        color: THEME.textDim,
                        zIndex: 11,
                        backdropFilter: 'saturate(180%) blur(10px)',
                    }}
                >
                    {statusItems && statusItems.length > 0 ? (
                        statusItems.map((item: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: item.color || THEME.textDim }}>{item.label}:</span>
                                <span style={{ fontWeight: 600, color: item.color || THEME.textMuted }}>
                                    {item.value}
                                </span>
                            </div>
                        ))
                    ) : (
                        <span>Status: Ready</span>
                    )}
                </footer>
            </div>
        </div>
    );
};

/* ── Shared styles ── */
const DemoStyles = () => (
    <style>{`
        @keyframes dpgFadeIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ovPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes ovPulseRing { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes kpi-in { from{opacity:0;transform:translateY(10px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes badge-crit { 0%,100%{opacity:1} 50%{opacity:.7} }
        .dpg-stagger > * { animation: dpgFadeIn 0.45s ease-out both; }
        .dpg-stagger > *:nth-child(1){animation-delay:0s}
        .dpg-stagger > *:nth-child(2){animation-delay:.07s}
        .dpg-stagger > *:nth-child(3){animation-delay:.14s}
        .dpg-stagger > *:nth-child(4){animation-delay:.21s}
        .dpg-stagger > *:nth-child(5){animation-delay:.28s}
        .dpg-stagger > *:nth-child(6){animation-delay:.35s}
        .dpg-metric { transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
        .demo-nav-item::-webkit-scrollbar { display: none; }
    `}</style>
);

export default React.memo(DemoLayout);

/* ─────────────────────────────────────────────────────────────────────────
   Re-usable sub-components — same API as before, rebuilt on THEME tokens
   and the shared tremor components so the demo matches the main app.
   ───────────────────────────────────────────────────────────────────────── */

/* ── Panel — thin wrapper over tremor PanelCard ───────────────────────── */
interface PanelProps {
    title?: any;
    icon?: any;
    rightNode?: any;
    children?: any;
    noPad?: any;
    accentColor?: any;
    style?: any;
}
export const Panel: React.FC<PanelProps> = ({
    title,
    icon,
    rightNode,
    children,
    noPad,
    accentColor,
    style = {},
}) => (
    <TremorPanelCard
        title={title}
        icon={icon}
        accentColor={accentColor}
        rightNode={rightNode}
        noPadding={noPad}
        style={style}
    >
        {children}
    </TremorPanelCard>
);

/* ── StatusBadge — re-exported from tremor for API stability ─────────── */
export const StatusBadge = TremorStatusBadge;

/* ── RingGauge — wraps tremor RingGauge with optional `max` support so
   engine tabs can pass `<RingGauge value={n} max={m} ... />` and have the
   tremor component render the corresponding percentage. ──────────────── */
interface RingGaugeProps {
    value: number;
    max?: number;
    color: string;
    size?: number;
    strokeWidth?: number;
    label?: string;
    showValue?: boolean;
    secondaryValue?: number | null;
    secondaryColor?: string;
    [k: string]: any;
}
export const RingGauge: React.FC<RingGaugeProps> = ({ value, max, ...rest }) => {
    const pct =
        typeof max === 'number' && max > 0
            ? Math.max(0, Math.min(100, Math.round((value / max) * 100)))
            : value;
    return <TremorRingGauge value={pct} {...(rest as any)} />;
};

/* ── MiniSparkline ────────────────────────────────────────────────────── */
interface MiniSparklineProps {
    data?: any[];
    color?: any;
    width?: any;
    height?: any;
    filled?: any;
}
export const MiniSparkline: React.FC<MiniSparklineProps> = ({
    data = [],
    color,
    width = 64,
    height = 20,
    filled = true,
}) => {
    const stroke = color || THEME.primary;
    if (!data || data.length < 2) return <div style={{ width, height }} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data
        .map(
            (v: number, i: number) =>
                `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`,
        )
        .join(' ');
    const uid = `dpgsp-${stroke.replace(/[^a-z0-9]/gi, '')}-${width}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
    return (
        <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
                <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
            </defs>
            {filled && <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${uid})`} />}
            <polyline
                points={pts}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

/* ── HeroMetric — large left-aligned KPI tile ─────────────────────────── */
interface HeroMetricProps {
    icon?: any;
    label?: any;
    value?: any;
    trend?: any;
    color?: any;
    sparkData?: any;
}
export const HeroMetric: React.FC<HeroMetricProps> = ({ icon: Icon, label, value, color, sparkData }) => {
    const c = color || THEME.primary;
    return (
        <div
            style={{
                background: THEME.surface,
                borderRadius: 16,
                border: `1px solid ${THEME.glassBorder}`,
                borderTop: `2px solid ${c}`,
                padding: '18px 22px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: THEME.shadowSm,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
            }}
        >
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${c}10`,
                    flexShrink: 0,
                }}
            >
                {Icon && <Icon size={20} color={c} strokeWidth={2} />}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: THEME.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 6,
                        lineHeight: 1,
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 800,
                        fontFamily: THEME.fontMono,
                        color: THEME.textMain,
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 8,
                        letterSpacing: '-0.02em',
                    }}
                >
                    {value}
                    {sparkData && <MiniSparkline data={sparkData} color={c} width={48} height={16} />}
                </div>
            </div>
        </div>
    );
};

/* ── MetricCard — primary KPI card, mirrors tremor KpiCard styling ─── */
interface MetricCardProps {
    icon?: any;
    label?: any;
    value?: any;
    sub?: any;
    subtitle?: any;
    color?: any;
    spark?: any;
    trend?: any;
    trendUp?: any;
    warn?: any;
}
export const MetricCard: React.FC<MetricCardProps> = ({
    icon: Icon,
    label,
    value,
    sub,
    subtitle,
    color,
    spark,
    trend,
    trendUp,
    warn,
}) => {
    const subText = sub || subtitle;
    const c = color || THEME.primary;
    const isUp = trendUp !== undefined ? trendUp : typeof trend === 'string' && !trend.startsWith('-');
    return (
        <div
            className="dpg-metric"
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '18px 20px',
                borderRadius: 16,
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderTop: `2px solid ${warn ? THEME.warning : c}`,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: THEME.shadowSm,
                animation: 'kpi-in 0.35s cubic-bezier(.22,.68,0,1.2) both',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = THEME.shadowMd;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = THEME.shadowSm;
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${c}10`,
                    }}
                >
                    {Icon && <Icon size={16} color={c} strokeWidth={2} />}
                </div>
                {spark && <MiniSparkline data={spark} color={c} width={56} height={20} />}
            </div>

            <div>
                <div
                    style={{
                        fontSize: 11,
                        color: THEME.textMuted,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        lineHeight: 1,
                        marginBottom: 6,
                    }}
                >
                    {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: THEME.textMain,
                            lineHeight: 1,
                            letterSpacing: '-0.03em',
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        {value}
                    </span>
                    {subText && (
                        <span style={{ fontSize: 11, color: THEME.textDim, fontWeight: 500 }}>
                            {subText}
                        </span>
                    )}
                </div>
            </div>

            {trend && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isUp ? (
                        <ArrowUpRight size={12} color={THEME.success} />
                    ) : (
                        <ArrowDownRight size={12} color={THEME.danger} />
                    )}
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: THEME.fontMono,
                            color: isUp ? THEME.success : THEME.danger,
                        }}
                    >
                        {trend}
                    </span>
                    <span style={{ fontSize: 10, color: THEME.textDim, marginLeft: 2 }}>vs last hr</span>
                </div>
            )}
        </div>
    );
};

/* ── LiveMetric — compact metric with sparkline + progress bar ───────── */
interface LiveMetricProps {
    icon?: any;
    label?: any;
    value?: any;
    unit?: any;
    spark?: any;
    color?: any;
    progress?: any;
}
export const LiveMetric: React.FC<LiveMetricProps> = ({ icon: Icon, label, value, unit, spark, color, progress }) => {
    const c = color || THEME.primary;
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '14px 18px',
                borderRadius: 16,
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                position: 'relative',
                overflow: 'hidden',
                flex: 1,
                minWidth: 120,
                boxShadow: THEME.shadowSm,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {Icon && (
                        <div
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `${c}12`,
                            }}
                        >
                            <Icon size={12} color={c} strokeWidth={2} />
                        </div>
                    )}
                    <span
                        style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: THEME.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}
                    >
                        {label}
                    </span>
                </div>
                {spark && <MiniSparkline data={spark} color={c} width={42} height={16} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span
                    style={{
                        fontSize: 20,
                        fontWeight: 800,
                        fontFamily: THEME.fontMono,
                        color: THEME.textMain,
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                    }}
                >
                    {value}
                </span>
                {unit && <span style={{ fontSize: 10.5, color: THEME.textDim }}>{unit}</span>}
            </div>
            {progress != null && (
                <div
                    style={{
                        height: 3,
                        borderRadius: 2,
                        background: `${c}18`,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${Math.min(progress, 100)}%`,
                            borderRadius: 2,
                            background: c,
                            transition: 'width 1s ease',
                        }}
                    />
                </div>
            )}
        </div>
    );
};

/* ── TabPills — sub-navigation pills ─────────────────────────────────── */
interface TabPillsProps {
    tabs?: any[];
    active?: any;
    onChange?: any;
    accentColor?: any;
}
export const TabPills: React.FC<TabPillsProps> = ({ tabs = [], active, onChange, accentColor }) => {
    const ac = accentColor || THEME.primary;
    return (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {tabs.map((t: any) => {
                /* Some demos pass `{key, label}` while the bespoke "Full" tabs
                   pass `{id, label}`. Treat either as the identifier so the
                   active highlight (and onChange call) work in both styles. */
                const tabId = t.key ?? t.id;
                const isActive = tabId !== undefined && tabId === active;
                return (
                    <button
                        key={tabId}
                        onClick={() => onChange(tabId)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: isActive ? 700 : 600,
                            padding: '7px 16px',
                            borderRadius: 10,
                            background: isActive ? ac : 'transparent',
                            color: isActive ? '#fff' : THEME.textMuted,
                            border: `1px solid ${isActive ? ac : THEME.glassBorder}`,
                            boxShadow: isActive ? `0 2px 8px ${ac}30` : 'none',
                            cursor: 'pointer',
                            fontFamily: THEME.fontBody,
                            transition: THEME.transitionFast,
                            letterSpacing: '0.01em',
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = THEME.surfaceHover;
                                e.currentTarget.style.color = THEME.textMain;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = THEME.textMuted;
                            }
                        }}
                    >
                        {t.icon && <t.icon size={13} />}
                        {t.label}
                        {t.badge && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                    background: isActive ? 'rgba(255,255,255,0.25)' : `${t.badgeColor || ac}18`,
                                    color: isActive ? '#fff' : t.badgeColor || ac,
                                }}
                            >
                                {t.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

/* ── AlertRow — alert list item ───────────────────────────────────────── */
interface AlertRowProps {
    severity?: any;
    title?: any;
    time?: any;
    source?: any;
    color?: any;
}
export const AlertRow: React.FC<AlertRowProps> = ({ severity, title, time, source, color }) => {
    const c = color || THEME.warning;
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '11px 14px',
                background: `${c}08`,
                borderBottom: `1px solid ${THEME.glassBorder}`,
                borderLeft: `2px solid ${c}`,
                marginBottom: 4,
            }}
        >
            <div
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: c,
                    flexShrink: 0,
                    marginTop: 4,
                }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: THEME.textMain, fontWeight: 600, lineHeight: 1.4 }}>
                    {title}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                    <span style={{ fontSize: 10, fontFamily: THEME.fontMono, color: THEME.textDim }}>{time}</span>
                    {source && <span style={{ fontSize: 10, color: THEME.textDim }}>{source}</span>}
                </div>
            </div>
            <span
                style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: `${c}14`,
                    color: c,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: THEME.fontMono,
                    flexShrink: 0,
                }}
            >
                {severity}
            </span>
        </div>
    );
};

/* ── DataTable — consistent table styling ─────────────────────────────── */
interface DataTableProps {
    columns?: any[];
    rows?: any[];
    accentColor?: any;
    headers?: any[];
    [k: string]: any;
}
export const DataTable: React.FC<DataTableProps> = ({ columns, rows = [], accentColor, headers }) => {
    void accentColor;
    // Back-compat: some engine tabs pass `headers={['A','B']}` + `rows={[[…]]}`.
    // Normalize to the {columns,rows} shape this component renders.
    const normalizedColumns: any[] =
        columns && columns.length
            ? columns
            : (headers || []).map((h: any, i: number) => ({ key: String(i), label: h }));
    const normalizedRows: any[] = (rows || []).map((row: any) => {
        if (Array.isArray(row)) {
            const obj: any = {};
            row.forEach((cell, i) => (obj[String(i)] = cell));
            return obj;
        }
        return row;
    });
    columns = normalizedColumns;
    rows = normalizedRows;
    return (
        <div style={{ fontSize: 12, color: THEME.textMuted }}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: columns.map((c: any) => c.width || '1fr').join(' '),
                    gap: 12,
                    padding: '12px 18px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                    fontWeight: 700,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: THEME.textDim,
                }}
            >
                {columns.map((c: any, i: number) => (
                    <span key={i} style={{ textAlign: c.align || 'left' }}>
                        {c.label}
                    </span>
                ))}
            </div>
            {rows.map((row: any, ri: number) => (
                <div
                    key={ri}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: columns.map((c: any) => c.width || '1fr').join(' '),
                        gap: 12,
                        padding: '12px 18px',
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = THEME.surfaceHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    {columns.map((c: any, ci: number) => (
                        <span
                            key={ci}
                            style={{
                                textAlign: c.align || 'left',
                                fontFamily: c.mono ? THEME.fontMono : 'inherit',
                                color:
                                    row[c.key + 'Color'] ||
                                    (c.mono ? THEME.textMain : THEME.textMuted),
                                fontWeight: ci === 0 ? 600 : 400,
                                fontSize: 12,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {row[c.key]}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
};

/* ── ChartTip — recharts tooltip skin ─────────────────────────────────── */
interface ChartTipProps {
    active?: any;
    payload?: any;
    label?: any;
}
export const ChartTip: React.FC<ChartTipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surfaceRaised,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 12,
                boxShadow: THEME.shadowMd,
            }}
        >
            {label && (
                <div
                    style={{
                        fontSize: 10,
                        color: THEME.textDim,
                        marginBottom: 6,
                        fontFamily: THEME.fontMono,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}
                >
                    {label}
                </div>
            )}
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: p.color || p.stroke || THEME.primary,
                            flexShrink: 0,
                        }}
                    />
                    <span style={{ color: THEME.textMuted, fontSize: 11 }}>{p.name || p.dataKey}:</span>
                    <span
                        style={{
                            color: THEME.textMain,
                            fontWeight: 700,
                            fontFamily: THEME.fontMono,
                            fontSize: 11,
                        }}
                    >
                        {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

/* ── ConnectionBar — connection/refresh status strip ─────────────────── */
interface ConnectionBarProps {
    lastSync?: any;
    refreshInterval?: any;
}
export const ConnectionBar: React.FC<ConnectionBarProps> = ({ lastSync = '8s', refreshInterval = '30s' }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 12,
            fontSize: 11,
            color: THEME.textDim,
            marginBottom: 16,
            boxShadow: THEME.shadowSm,
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.success }} />
                <span style={{ fontWeight: 700, color: THEME.textMain }}>Connected</span>
            </span>
            <span>Last sync {lastSync} ago</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Auto-refresh:
                {['10s', '30s', '1m', '5m', 'Off'].map((v) => (
                    <span
                        key={v}
                        style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            background: v === refreshInterval ? THEME.primary : 'transparent',
                            color: v === refreshInterval ? '#fff' : THEME.textDim,
                            cursor: 'pointer',
                            fontFamily: THEME.fontMono,
                        }}
                    >
                        {v}
                    </span>
                ))}
            </span>
        </div>
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: THEME.primary,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 11,
            }}
        >
            ↻ Refresh now
        </div>
    </div>
);

export const generateChartData = (hours = 24) =>
    Array.from({ length: hours }, (_, i) => ({ time: `${String(i).padStart(2, '0')}:00` }));

/* ExecStatCard - large hero KPI card */
interface ExecStatCardProps {
    value?: any;
    label?: any;
    subtitle?: any;
    color?: any;
}
export const ExecStatCard: React.FC<ExecStatCardProps> = ({ value, label, subtitle, color }) => {
    const c = color || THEME.primary;
    return (
        <div
            style={{
                background: THEME.surface,
                borderRadius: 16,
                padding: '24px 22px',
                border: `1px solid ${THEME.glassBorder}`,
                borderTop: `2px solid ${c}`,
                transition: THEME.transitionBase,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: THEME.shadowSm,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = THEME.shadowMd;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = THEME.shadowSm;
            }}
        >
            <div
                style={{
                    fontSize: 38,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: metricValue(c),
                    marginBottom: 8,
                    fontFamily: THEME.fontMono,
                    lineHeight: 1,
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: THEME.textMuted,
                    marginBottom: 4,
                }}
            >
                {label}
            </div>
            {subtitle && <div style={{ fontSize: 10.5, color: THEME.textDim }}>{subtitle}</div>}
        </div>
    );
};
