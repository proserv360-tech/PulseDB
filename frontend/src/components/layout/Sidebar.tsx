// Main navigation sidebar.
// Extracted from App.tsx.
import { ChevronLeft, ChevronRight, Database, LogOut, MessageSquarePlus, User, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getGroupForTab, getSectionForTab, SECTION_GROUPS } from '../../app/tabRegistry';
import { DS } from '../../config/designTokens';
import ByProserv360 from '../ui/ByProserv360';
import { useConnection } from '../../context/ConnectionContext';
import { THEME } from '../../utils/theme';

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────────────────────────── */
export const Sidebar = ({
    activeTab,
    onTabChange,
    onLogout,
    currentUser,
    collapsed,
    onToggleCollapse,
    onOpenFeedback,
    onOpenProfile,
    allowedTabIds,
}) => {
    const { activeConnection, loading: connectionsLoading } = useConnection();
    const [openSections, setOpenSections] = useState(() => {
        const active = getSectionForTab(activeTab);
        const parentGrp = getGroupForTab(activeTab);
        const s = new Set();
        if (active) s.add(active);
        if (parentGrp) s.add(parentGrp);
        return s;
    });

    // Track which sub-group tabs (those with children[]) are expanded
    const [openSubGroups, setOpenSubGroups] = useState<Set<string>>(() => new Set<string>());

    const toggleSubGroup = useCallback((tabId: string) => {
        setOpenSubGroups((prev) => {
            const next = new Set(prev);
            next.has(tabId) ? next.delete(tabId) : next.add(tabId);
            return next;
        });
    }, []);

    /* Sidebar state */

    useEffect(() => {
        const sec = getSectionForTab(activeTab);
        const parentGrp = getGroupForTab(activeTab);
        setOpenSections((prev) => {
            const needs = [];
            if (sec && !prev.has(sec)) needs.push(sec);
            if (parentGrp && !prev.has(parentGrp)) needs.push(parentGrp);
            if (needs.length === 0) return prev;
            return new Set([...prev, ...needs]);
        });
        // Auto-open sub-group if the active tab is a child
        visibleGroups.forEach((grp: any) => {
            (grp.tabs || []).forEach((tab: any) => {
                if (tab.children?.some((c: any) => c.id === activeTab)) {
                    setOpenSubGroups((prev) => {
                        if (prev.has(tab.id)) return prev;
                        return new Set([...prev, tab.id]);
                    });
                }
            });
        });
    }, [activeTab]);

    const toggleSection = useCallback(
        (sec) => {
            setOpenSections((prev) => {
                const next = new Set(prev);
                next.has(sec) ? next.delete(sec) : next.add(sec);
                return next;
            });
            // Auto-navigate into demo when Demo section is clicked
            if (sec === 'Demo' && onTabChange) {
                onTabChange('demo-postgres');
            }
        },
        [onTabChange],
    );

    // Only show DB-specific sections for real connections (demo has its own inner nav)
    // activeConnection is hydrated from localStorage cache, so dbType is available immediately
    const connDbType = activeConnection?.dbType || null;

    // Sections shown per database type
    const PG_SECTIONS = [
        'Connections',
        'Overview',
        'Alerts & Rules',
        'Query Analysis',
        'Schema & Data',
        'Infrastructure',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ];
    const MYSQL_SECTIONS = [
        'Connections',
        'MySQL',
        'Overview',
        'Alerts & Rules',
        'Security',
        'Observability',
        'Developer Tools',
        'Admin',
    ];
    // Only the screens that work through the SQL Server adapter: its own section
    // and, under Developer Tools, the engine console (the rest there is Postgres-only).
    const MSSQL_SECTIONS = ['Connections', 'SQL Server', 'Developer Tools', 'Admin'];
    const MSSQL_DEV_TOOLS = ['engine-console'];
    const isMssql = connDbType === 'mssql' || connDbType === 'sqlserver';
    const MONGO_SECTIONS = [
        'Connections',
        'MongoDB',
        'Overview',
        'Alerts & Rules',
        'Security',
        'Observability',
        'Admin',
    ];

    // Demo users (username contains "demo_user") see ONLY the Demo section.
    const isDemoUser = (currentUser?.username || '').toLowerCase().includes('demo_user');

    const visibleGroups = useMemo(
        () =>
            SECTION_GROUPS.map((g) => ({
                ...g,
                tabs: g.tabs.filter(
                    (t) =>
                        allowedTabIds.includes(t.id) &&
                        !(isMssql && g.section === 'Developer Tools' && !MSSQL_DEV_TOOLS.includes(t.id)),
                ),
            }))
                .filter((g) => g.tabs.length > 0)
                .filter((g) => {
                    // Demo users: nothing but the Demo section.
                    if (isDemoUser) return g.section === 'Demo';
                    // Demo always visible
                    if (g.section === 'Demo') return true;
                    // User Management only for super_admin
                    if (g.section === 'User Management') return currentUser?.role === 'super_admin';
                    // No connection → hide everything else
                    if (!connDbType) return false;
                    // Show sections based on DB type
                    if (connDbType === 'postgresql') return PG_SECTIONS.includes(g.section);
                    if (connDbType === 'mysql' || connDbType === 'mariadb') return MYSQL_SECTIONS.includes(g.section);
                    if (connDbType === 'mongodb') return MONGO_SECTIONS.includes(g.section);
                    if (isMssql) return MSSQL_SECTIONS.includes(g.section);
                    return false;
                }),
        [allowedTabIds, connDbType, isMssql, currentUser, activeTab, isDemoUser],
    );

    /* Build flat nav: each section becomes a { type:'section', ... } entry */
    const groupedNav = useMemo(() => {
        return visibleGroups.map((g) => ({ type: 'section', ...g }));
    }, [visibleGroups]);

    const W = collapsed ? 56 : 256;

    return (
        <aside
            style={{
                width: W,
                minWidth: W,
                background: DS.sidebarBg,
                borderRight: `1px solid ${DS.sidebarBorder}`,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 50,
                flexShrink: 0,
                transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Right-edge gradient rule — handled by aside::after in CSS */}

            {/* ── LOGO ── */}
            <div
                style={{
                    height: 54,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? 0 : '0 16px',
                    gap: 10,
                    borderBottom: `1px solid ${DS.sidebarBorder}`,
                }}
            >
                {/* Icon mark */}
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${DS.cyan}, ${DS.violet || THEME.primary})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        border: `1px solid ${DS.cyan}40`,
                    }}
                >
                    <Database color={THEME.textInverse} size={16} strokeWidth={2.5} />
                </div>

                {/* Wordmark — hidden when collapsed */}
                {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 800,
                                letterSpacing: '-0.03em',
                                color: DS.logoText,
                            }}
                        >
                            Pulse<span style={{ color: DS.cyan }}>DB</span>
                        </span>
                        <ByProserv360 height={11} color={DS.logoSub} style={{ marginTop: 4 }} />
                    </div>
                )}
            </div>

            {/* Search bar and recently viewed removed */}

            {/* ── NAV ── */}
            <nav
                className="sidebar-nav"
                role="navigation"
                aria-label="Main navigation"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '6px 8px',
                }}
            >
                {/* ── Tree-style collapsible navigation ── */}
                {(() => {
                    /* ── Child leaf: indented tab under a sub-group ── */
                    const renderChildTab = (tab, accent) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                id={`${tab.id}-tab`}
                                key={tab.id}
                                className="nav-item"
                                onClick={() => onTabChange(tab.id)}
                                role="tab"
                                aria-selected={isActive}
                                aria-label={tab.label}
                                title={collapsed ? tab.label : undefined}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    gap: 8,
                                    padding: collapsed ? '6px 0' : '5px 10px 5px 44px',
                                    background: isActive ? `${accent}15` : 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: isActive ? accent : DS.sidebarText,
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: 12,
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s ease',
                                    position: 'relative',
                                    margin: '1px 0',
                                    opacity: 0.9,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = DS.sidebarHover;
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                            >
                                {/* Deeper tree connector */}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 28,
                                            top: 0,
                                            bottom: 0,
                                            width: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}10`,
                                        }}
                                    />
                                )}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 28,
                                            top: '50%',
                                            width: 10,
                                            height: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}10`,
                                        }}
                                    />
                                )}
                                <tab.icon size={12} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                                {!collapsed && (
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                        {tab.label}
                                    </span>
                                )}
                            </button>
                        );
                    };

                    /* ── Leaf node: single tab item ── */
                    const renderTab = (tab, accent) => {
                        const isActive = activeTab === tab.id;

                        // Sub-group: tab with children — render as inline collapsible branch
                        if (tab.children?.length) {
                            const isSubOpen = collapsed || openSubGroups.has(tab.id);
                            const hasActiveChild = tab.children.some((c) => c.id === activeTab);
                            const isParentActive = activeTab === tab.id;
                            return (
                                <div key={tab.id}>
                                    {/* Parent row — clickable: navigates + toggles children */}
                                    <button
                                        id={`${tab.id}-tab`}
                                        className="nav-item"
                                        onClick={() => {
                                            onTabChange(tab.id);
                                            toggleSubGroup(tab.id);
                                        }}
                                        role="tab"
                                        aria-selected={isParentActive}
                                        aria-expanded={isSubOpen}
                                        aria-label={tab.label}
                                        title={collapsed ? tab.label : undefined}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: collapsed ? 'center' : 'flex-start',
                                            gap: 8,
                                            padding: collapsed ? '7px 0' : '6px 10px 6px 28px',
                                            background:
                                                isParentActive || hasActiveChild ? `${accent}15` : 'transparent',
                                            border: 'none',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: isParentActive || hasActiveChild ? accent : DS.sidebarText,
                                            fontWeight: isParentActive || hasActiveChild ? 600 : 400,
                                            fontSize: 12.5,
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            fontFamily: DS.fontUI,
                                            transition: 'all 0.15s ease',
                                            position: 'relative',
                                            margin: '1px 0',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isParentActive && !hasActiveChild) {
                                                e.currentTarget.style.background = DS.sidebarHover;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isParentActive && !hasActiveChild) {
                                                e.currentTarget.style.background = 'transparent';
                                            }
                                        }}
                                    >
                                        {/* Tree connectors */}
                                        {!collapsed && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    left: 14,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: 1,
                                                    background:
                                                        isParentActive || hasActiveChild
                                                            ? `${accent}40`
                                                            : `${DS.sidebarText}15`,
                                                }}
                                            />
                                        )}
                                        {!collapsed && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    left: 14,
                                                    top: '50%',
                                                    width: 8,
                                                    height: 1,
                                                    background:
                                                        isParentActive || hasActiveChild
                                                            ? `${accent}40`
                                                            : `${DS.sidebarText}15`,
                                                }}
                                            />
                                        )}
                                        <tab.icon size={14} style={{ flexShrink: 0 }} />
                                        {!collapsed && (
                                            <>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                                    {tab.label}
                                                </span>
                                                {/* Chevron indicator */}
                                                <ChevronRight
                                                    size={11}
                                                    style={{
                                                        flexShrink: 0,
                                                        marginRight: 4,
                                                        transition: 'transform 0.2s ease',
                                                        transform: isSubOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                                        opacity: 0.5,
                                                    }}
                                                />
                                            </>
                                        )}
                                    </button>
                                    {/* Children */}
                                    {isSubOpen && !collapsed && (
                                        <div style={{ overflow: 'hidden' }}>
                                            {tab.children.map((child) => renderChildTab(child, accent))}
                                        </div>
                                    )}
                                    {isSubOpen && collapsed && (
                                        <div>{tab.children.map((child) => renderChildTab(child, accent))}</div>
                                    )}
                                </div>
                            );
                        }
                        return (
                            <button
                                id={`${tab.id}-tab`}
                                key={tab.id}
                                className="nav-item"
                                onClick={() => onTabChange(tab.id)}
                                role="tab"
                                aria-selected={isActive}
                                aria-label={tab.label}
                                title={collapsed ? tab.label : undefined}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    gap: 8,
                                    padding: collapsed ? '7px 0' : '6px 10px 6px 28px',
                                    background: isActive ? `${accent}15` : 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: isActive ? accent : DS.sidebarText,
                                    fontWeight: isActive ? 600 : 400,
                                    fontSize: 12.5,
                                    textAlign: 'left',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s ease',
                                    position: 'relative',
                                    margin: '1px 0',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = DS.sidebarHover;
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = DS.sidebarText;
                                    }
                                }}
                            >
                                {/* Tree connector line */}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 14,
                                            top: 0,
                                            bottom: 0,
                                            width: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}15`,
                                        }}
                                    />
                                )}
                                {!collapsed && (
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: 14,
                                            top: '50%',
                                            width: 8,
                                            height: 1,
                                            background: isActive ? `${accent}40` : `${DS.sidebarText}15`,
                                        }}
                                    />
                                )}
                                <tab.icon
                                    size={14}
                                    style={{
                                        flexShrink: 0,
                                        opacity: isActive ? 1 : 0.55,
                                        filter: isActive ? `drop-shadow(0 0 3px ${accent}60)` : 'none',
                                    }}
                                />
                                {!collapsed && (
                                    <>
                                        <span
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {tab.label}
                                        </span>
                                        {tab.badge && (
                                            <span
                                                style={{
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    padding: '1px 5px',
                                                    borderRadius: 8,
                                                    background: 'rgba(251,113,133,0.15)',
                                                    color: DS.rose,
                                                    border: '1px solid rgba(251,113,133,0.25)',
                                                    fontFamily: DS.fontMono,
                                                    lineHeight: '14px',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {tab.badge}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        );
                    };

                    /* ── Branch node: section header ── */
                    const renderBranch = (label, sectionKey, accent, hasActive, isOpen, tabCount) => (
                        <button
                            className="section-btn"
                            onClick={() => toggleSection(sectionKey)}
                            role="group"
                            aria-label={label}
                            aria-expanded={isOpen}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 8px',
                                background: hasActive && !isOpen ? `${accent}10` : 'transparent',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                marginTop: 2,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = DS.sidebarHover;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = hasActive && !isOpen ? `${accent}10` : 'transparent';
                            }}
                        >
                            {/* Chevron */}
                            <ChevronRight
                                size={12}
                                color={hasActive ? accent : DS.sidebarText}
                                style={{
                                    flexShrink: 0,
                                    transition: 'transform 0.2s ease',
                                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    opacity: 0.7,
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    letterSpacing: '0.03em',
                                    fontFamily: DS.fontUI,
                                    color: hasActive ? accent : DS.sidebarText,
                                    flex: 1,
                                    minWidth: 0,
                                    textAlign: 'left',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {label}
                            </span>
                        </button>
                    );

                    /* ── Render all nav items ── */
                    return groupedNav.map((item, gi) => {
                        const group = item;
                        const isOpen = collapsed || openSections.has(group.section);
                        const hasActive = group.tabs.some((t) => t.id === activeTab);

                        return (
                            <div key={group.section} style={{ marginBottom: 1 }}>
                                {collapsed
                                    ? gi > 0 && (
                                          <div
                                              style={{
                                                  margin: '4px 12px',
                                                  height: 1,
                                                  background: `linear-gradient(90deg, transparent, ${group.accent}30, transparent)`,
                                              }}
                                          />
                                      )
                                    : renderBranch(
                                          group.section,
                                          group.section,
                                          group.accent,
                                          hasActive,
                                          isOpen,
                                          group.tabs.length,
                                      )}
                                {isOpen && (
                                    <div
                                        style={{
                                            overflow: 'hidden',
                                            transition: 'max-height 0.25s ease',
                                            position: 'relative',
                                        }}
                                    >
                                        {group.tabs.map((tab) => renderTab(tab, group.accent))}
                                    </div>
                                )}
                            </div>
                        );
                    });
                })()}
            </nav>

            {/* ── FOOTER ── */}
            <div
                style={{
                    borderTop: `1px solid ${DS.border}`,
                    padding: collapsed ? '8px 6px' : '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                }}
            >
                {/* ── User profile pill ── */}
                <button
                    onClick={onOpenProfile}
                    title={collapsed ? currentUser?.name || 'Profile' : 'Edit profile'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap: 10,
                        padding: collapsed ? '8px 0' : '8px 10px',
                        marginBottom: 4,
                        background: 'rgba(99,102,241,0.10)',
                        borderRadius: 8,
                        border: '1px solid rgba(99,102,241,0.18)',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.30)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(99,102,241,0.10)';
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.18)';
                    }}
                >
                    {/* Avatar */}
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            flexShrink: 0,
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.3))',
                            border: '1px solid rgba(99,102,241,0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <User size={13} color={DS.cyan} />
                    </div>
                    {!collapsed && (
                        <>
                            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: 'rgba(255,255,255,0.9)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        lineHeight: '15px',
                                    }}
                                >
                                    {currentUser?.name || currentUser?.username || 'User'}
                                </div>
                                <div
                                    style={{
                                        fontSize: 9.5,
                                        color: DS.cyan,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.04em',
                                        lineHeight: '13px',
                                    }}
                                >
                                    Online
                                </div>
                            </div>
                            <div
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: DS.cyan,
                                    flexShrink: 0,
                                    boxShadow: 'none',
                                }}
                            />
                        </>
                    )}
                </button>

                {/* ── Quick action row ── */}
                {collapsed ? (
                    /* Collapsed: vertical icon stack */
                    <>
                        {[
                            currentUser?.role === 'super_admin' && {
                                icon: Users,
                                action: () => onTabChange('UserManagement'),
                                tip: 'User Management',
                                active: activeTab === 'UserManagement' || activeTab === 'user-audit',
                            },
                            {
                                icon: Database,
                                action: () => onTabChange('demo-postgres'),
                                tip: 'Demo',
                                active: activeTab?.startsWith('demo-'),
                            },
                            // Feedback is scoped to a connection — hide it when none exists.
                            connDbType && {
                                icon: MessageSquarePlus,
                                action: onOpenFeedback,
                                tip: 'Feedback',
                                active: false,
                            },
                            { icon: LogOut, action: onLogout, tip: 'Sign Out', active: false, danger: true },
                        ]
                            .filter(Boolean)
                            .map(({ icon: Icon, action, tip, active, danger }) => (
                                <button
                                    key={tip}
                                    onClick={action}
                                    title={tip}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '7px 0',
                                        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        width: '100%',
                                        color: active ? DS.cyan : 'rgba(255,255,255,0.6)',
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = danger ? DS.rose : DS.cyan;
                                        e.currentTarget.style.background = danger
                                            ? 'rgba(251,113,133,0.12)'
                                            : 'rgba(99,102,241,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = active ? DS.cyan : 'rgba(255,255,255,0.6)';
                                        e.currentTarget.style.background = active
                                            ? 'rgba(99,102,241,0.15)'
                                            : 'transparent';
                                    }}
                                >
                                    <Icon size={14} />
                                </button>
                            ))}
                    </>
                ) : (
                    /* Expanded: compact button rows */
                    <>
                        {/* Nav buttons: User Management (super_admin only) & Demo */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                            {[
                                currentUser?.role === 'super_admin' && {
                                    icon: Users,
                                    label: 'Users',
                                    action: () => onTabChange('UserManagement'),
                                    active: activeTab === 'UserManagement' || activeTab === 'user-audit',
                                },
                                {
                                    icon: Database,
                                    label: 'Demo',
                                    action: () => onTabChange('demo-postgres'),
                                    active: activeTab?.startsWith('demo-'),
                                },
                            ]
                                .filter(Boolean)
                                .map(({ icon: Icon, label, action, active }) => (
                                    <button
                                        key={label}
                                        onClick={action}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            padding: '6px 8px',
                                            background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                                            border: active
                                                ? '1px solid rgba(99,102,241,0.25)'
                                                : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: active ? DS.cyan : 'rgba(255,255,255,0.7)',
                                            fontSize: 11,
                                            fontWeight: active ? 600 : 500,
                                            fontFamily: DS.fontUI,
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
                                            e.currentTarget.style.color = DS.cyan;
                                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = active
                                                ? 'rgba(99,102,241,0.15)'
                                                : 'rgba(255,255,255,0.06)';
                                            e.currentTarget.style.color = active ? DS.cyan : 'rgba(255,255,255,0.7)';
                                            e.currentTarget.style.borderColor = active
                                                ? 'rgba(99,102,241,0.25)'
                                                : 'rgba(255,255,255,0.08)';
                                        }}
                                    >
                                        <Icon size={12} />
                                        {label}
                                    </button>
                                ))}
                        </div>
                        {/* Utility buttons: Feedback & Sign Out */}
                        <div style={{ display: 'flex', gap: 4 }}>
                            {/* Feedback is scoped to a connection — hidden when none exists. */}
                            {connDbType && (
                                <button
                                    onClick={onOpenFeedback}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        padding: '6px 8px',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: 11,
                                        fontWeight: 500,
                                        fontFamily: DS.fontUI,
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(99,102,241,0.15)';
                                        e.currentTarget.style.color = DS.cyan;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                    }}
                                >
                                    <MessageSquarePlus size={12} />
                                    Feedback
                                </button>
                            )}
                            <button
                                onClick={onLogout}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    padding: '6px 8px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    fontFamily: DS.fontUI,
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                                    e.currentTarget.style.color = DS.rose;
                                    e.currentTarget.style.borderColor = 'rgba(251,113,133,0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                }}
                            >
                                <LogOut size={12} />
                                Sign Out
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── COLLAPSE TOGGLE ── */}
            <button
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{
                    position: 'absolute',
                    right: -11,
                    top: 76,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: DS.surface,
                    border: `1px solid ${DS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: DS.sidebarText,
                    zIndex: 51,
                    transition: 'all 0.2s ease',
                    boxShadow: DS.shadowCard,
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = DS.cyan;
                    e.currentTarget.style.color = DS._dark ? THEME.deepTeal : THEME.surface;
                    e.currentTarget.style.borderColor = DS.cyan;
                    e.currentTarget.style.boxShadow = DS.glowCyan;
                    e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = DS.surface;
                    e.currentTarget.style.color = DS.sidebarText;
                    e.currentTarget.style.borderColor = DS.border;
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
        </aside>
    );
};
