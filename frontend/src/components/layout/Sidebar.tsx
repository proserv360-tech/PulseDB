import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Database,
    Folder,
    FolderOpen,
    LogOut,
    MessageSquarePlus,
    User,
    Users,
} from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';
import { DS } from '../../config/designTokens';
import { THEME } from '../../utils/theme';
import { buildTabConfig, getSectionGroups } from '../../config/tabConfig';

const SECTION_GROUPS = getSectionGroups(buildTabConfig());

const getSectionForTab = (tabId) => {
    for (const g of SECTION_GROUPS) {
        if (g.tabs.some((t) => t.id === tabId)) return g.section;
    }
    return null;
};

const getGroupForTab = () => null;

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

    /* Sidebar state */

    // Tab-level tree: a parent tab id -> ordered child tab ids nested under it.
    const TAB_CHILDREN = {
        'observability-hub': [
            'obs-overview',
            'obs-api',
            'obs-exceptions',
            'obs-uptime',
            'obs-audit',
            'obs-jobs',
            'obs-slo',
            'obs-alerts',
            'obs-logs',
            'obs-infra',
            'obs-topology',
            'obs-ai',
            'obs-cost',
            'obs-traces',
        ],
    };
    const CHILD_TO_PARENT = Object.fromEntries(
        Object.entries(TAB_CHILDREN).flatMap(([parent, kids]) => kids.map((k) => [k, parent])),
    );

    const [openTabs, setOpenTabs] = useState(() => {
        const s = new Set();
        // Start collapsed. Only auto-expand a parent when one of its CHILDREN
        // is the active tab (so the active child stays visible). Landing on the
        // parent tab itself does NOT auto-expand — the user toggles it.
        const parent = CHILD_TO_PARENT[activeTab];
        if (parent) s.add(parent);
        return s;
    });
    const toggleTabTree = useCallback((tabId) => {
        setOpenTabs((prev) => {
            const next = new Set(prev);
            next.has(tabId) ? next.delete(tabId) : next.add(tabId);
            return next;
        });
    }, []);

    // Keep a parent expanded when one of its children is active.
    useEffect(() => {
        const parent = CHILD_TO_PARENT[activeTab];
        if (parent) setOpenTabs((prev) => (prev.has(parent) ? prev : new Set([...prev, parent])));
    }, [activeTab]);

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
            SECTION_GROUPS.map((g) => ({ ...g, tabs: g.tabs.filter((t) => allowedTabIds.includes(t.id)) }))
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
                    return false;
                }),
        [allowedTabIds, connDbType, currentUser, activeTab, isDemoUser],
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
                            PG <span style={{ color: DS.cyan }}>Monitor</span>
                        </span>
                        <span
                            style={{
                                fontSize: 9,
                                letterSpacing: '0.14em',
                                color: DS.logoSub,
                                fontFamily: DS.fontMono,
                                marginTop: 2,
                            }}
                        >
                            Database Intelligence
                        </span>
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
                    /* ── Leaf node: single tab item ── */
                    const renderTab = (tab, accent) => {
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
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
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

                    /* ── Parent tab with a collapsible child tree (e.g. Observability Hub) ── */
                    const renderParentTab = (tab, accent, open) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={`${tab.id}-parent`}
                                className="nav-item"
                                onClick={() => {
                                    onTabChange(tab.id);
                                    toggleTabTree(tab.id);
                                }}
                                title={collapsed ? tab.label : undefined}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    gap: 8,
                                    padding: collapsed ? '7px 0' : '6px 10px 6px 22px',
                                    background: isActive ? `${accent}15` : 'transparent',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    color: isActive ? accent : DS.sidebarText,
                                    fontWeight: isActive ? 600 : 500,
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
                                    if (!isActive) e.currentTarget.style.background = DS.sidebarHover;
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {!collapsed && (
                                    <ChevronRight
                                        size={13}
                                        style={{
                                            flexShrink: 0,
                                            opacity: 0.7,
                                            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease',
                                        }}
                                    />
                                )}
                                {open ? (
                                    <FolderOpen size={15} style={{ flexShrink: 0, color: THEME.warning }} />
                                ) : (
                                    <Folder size={15} style={{ flexShrink: 0, color: THEME.warning }} />
                                )}
                                {!collapsed && (
                                    <span
                                        style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                                    >
                                        {tab.label}
                                    </span>
                                )}
                            </button>
                        );
                    };

                    /* ── Tree-leaf child tab (under an expandable parent) ── */
                    const renderChildTab = (tab, accent) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                className="nav-item"
                                onClick={() => onTabChange(tab.id)}
                                title={tab.label}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '5px 10px 5px 28px',
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
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) e.currentTarget.style.background = DS.sidebarHover;
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {/* dotted dash connector from the trunk, file-tree style */}
                                <span
                                    style={{
                                        flexShrink: 0,
                                        color: `${DS.sidebarText}99`,
                                        fontSize: 13,
                                        lineHeight: 1,
                                        marginLeft: 2,
                                        marginRight: 1,
                                        userSelect: 'none',
                                    }}
                                >
                                    —
                                </span>
                                <tab.icon size={13} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {tab.label}
                                </span>
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
                                        {group.tabs
                                            .filter((tab) => !CHILD_TO_PARENT[tab.id])
                                            .map((tab) => {
                                                const childIds = TAB_CHILDREN[tab.id];
                                                if (!childIds) return renderTab(tab, group.accent);
                                                // Expandable parent tab (tree node)
                                                const open = openTabs.has(tab.id);
                                                const children = group.tabs.filter((t) => childIds.includes(t.id));
                                                return (
                                                    <div key={tab.id}>
                                                        {renderParentTab(tab, group.accent, open)}
                                                        {open && !collapsed && (
                                                            <div style={{ position: 'relative', paddingLeft: 18 }}>
                                                                {/* vertical trunk */}
                                                                <span
                                                                    style={{
                                                                        position: 'absolute',
                                                                        left: 20,
                                                                        top: 0,
                                                                        bottom: 16,
                                                                        width: 0,
                                                                        borderLeft: `2px dotted ${DS.sidebarText}66`,
                                                                    }}
                                                                />
                                                                {children.map((c) => renderChildTab(c, group.accent))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
                        <div style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
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
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
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
