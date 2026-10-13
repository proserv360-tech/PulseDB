// Authenticated app shell: sidebar, header, and the active tab.
// Extracted from App.tsx.
import { WifiOff, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppStyles } from '../components/layout/AppStyles';
import { ConnectionSelector } from '../components/layout/ConnectionSelector';
import { FeedbackModal } from '../components/layout/FeedbackModal';
import { AmbientOrbs, GlobalRefreshButton, StatusPill, ThemeToggle } from '../components/layout/HeaderControls';
import { NotificationCenter, SEV_COLORS } from '../components/layout/NotificationCenter';
import { ProfileModal } from '../components/layout/ProfileModal';
import { Sidebar } from '../components/layout/Sidebar';
import CommandPalette from '../components/shared/CommandPalette';
import SectionErrorBoundary from '../components/shared/SectionErrorBoundary';
import { AlertBanner } from '../components/ui/SharedComponents';
import { DS, DS_DARK, DS_LIGHT, setDS } from '../config/designTokens';
import { STORAGE_KEYS } from '../config/tabConfig';
import { useAuth } from '../context/AuthContext';
import { ConnectionProvider, useConnection } from '../context/ConnectionContext';
import { useDemo } from '../context/DemoContext';
import { NavigationContext } from '../context/NavigationContext';
import { useTheme } from '../context/ThemeContext';
import { LicenseProvider } from '../enterprise/context/LicenseContext';
import { OrgProvider } from '../enterprise/context/OrgContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChartDefs, THEME, useAdaptiveTheme } from '../utils/theme';
import { ALERT_AUTO_DISMISS_TIME, MAX_NOTIFICATIONS } from './constants';
import { ErrorBoundary } from './ErrorBoundary';
import {
    ConnectionSwitcherLazy,
    DatabaseSwitcherLazy,
    getSectionAccent,
    getSectionForTab,
    PHASE5_DEMO_TABS,
    SECTION_GROUPS,
    TABS_ONLY,
} from './tabRegistry';

/* ─────────────────────────────────────────────────────────────────
   DASHBOARD
   ───────────────────────────────────────────────────────────────── */
export const Dashboard = ({ onLogout }) => (
    <ConnectionProvider>
        {/* Enterprise providers — required by LicenseGate (Redis/Elasticsearch/
            Anomaly Detectors/Trace Detail views) and by useOrg() consumers. */}
        <LicenseProvider>
            <OrgProvider>
                <DashboardInner onLogout={onLogout} />
            </OrgProvider>
        </LicenseProvider>
    </ConnectionProvider>
);

const DashboardInner = ({ onLogout }) => {
    const { logout: authLogout, currentUser: authUser } = useAuth();
    const { isDemo, demoUser } = useDemo();
    const currentUser = authUser || (isDemo ? demoUser : null);
    // Use the parent-provided onLogout (which plays the fade-out) if available,
    // falling back to the raw logout for any edge-cases.
    const logout = onLogout || authLogout;
    const { isDark } = useTheme();
    useAdaptiveTheme(); // also keeps module-level THEME in sync for ChartDefs + GlobalStyles

    /* Keep module-level DS in sync with ThemeContext on every render */
    setDS(isDark ? DS_DARK : DS_LIGHT);

    // Default to 'overview' always. The ACTIVE_TAB key is cleared by AuthContext
    // on logout, so every fresh login session starts at the Overview page.
    // Within a session, tab navigation is persisted as before.
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
            // Migrate legacy default: UserManagement → connections
            if (saved === 'UserManagement') return 'connections';
            return saved || 'connections';
        } catch {
            return 'connections';
        }
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
        } catch {
            return false;
        }
    });

    // Cross-component tab navigation. Any component can dispatch
    //   window.dispatchEvent(new CustomEvent('fathom:navigate-tab',
    //     { detail: { tab: 'trace-correlation', payload: { traceId } } }))
    // to switch tabs and hand a payload to the target tab (read once from
    // sessionStorage under fathom:tab-payload:<tab>).
    useEffect(() => {
        const onNav = (e) => {
            const tab = e && e.detail && e.detail.tab;
            if (!tab) return;
            if (e.detail.payload !== undefined) {
                try {
                    sessionStorage.setItem('fathom:tab-payload:' + tab, JSON.stringify(e.detail.payload));
                } catch {
                    /* ignore */
                }
            }
            setActiveTab(tab);
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch {
                /* ignore */
            }
        };
        window.addEventListener('fathom:navigate-tab', onNav);
        return () => window.removeEventListener('fathom:navigate-tab', onNav);
    }, []);
    const [notifications, setNotifications] = useState([]);
    const [latestAlert, setLatestAlert] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [profileUser, setProfileUser] = useState(currentUser);
    const prevTabRef = useRef(activeTab);

    // Demo accounts (demo_user1..N) land straight in the demo experience instead
    // of the empty "No connections yet" screen. Runs once per login session.
    const demoRedirectedRef = useRef(false);
    useEffect(() => {
        const uname = (authUser?.username || '').toLowerCase();
        if (!demoRedirectedRef.current && uname.startsWith('demo_user')) {
            demoRedirectedRef.current = true;
            setActiveTab('demo-postgres');
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'demo-postgres');
            } catch {
                /* ignore */
            }
        }
    }, [authUser]);

    const handleWSMessage = useCallback((msg) => {
        if (msg.type === 'alert') {
            const n = {
                id: Date.now(),
                title: msg.payload.title || 'Alert',
                message: msg.payload.message,
                severity: msg.payload.severity || 'info',
                timestamp: Date.now(),
                read: false,
            };
            setNotifications((p) => [n, ...p].slice(0, MAX_NOTIFICATIONS));
            setLatestAlert(msg.payload);
            setTimeout(() => setLatestAlert(null), ALERT_AUTO_DISMISS_TIME);
        }
    }, []);

    const { connected, reconnecting } = useWebSocket(handleWSMessage);
    const { activeConnection, loading: connectionsLoading } = useConnection();

    // Feedback prompt — only when at least one connection exists. Feedback is
    // scoped to a connected database, so with no connection there's nothing to
    // give feedback on and the prompt (and button) are hidden.
    useEffect(() => {
        if (!activeConnection) return;
        if (!localStorage.getItem(STORAGE_KEYS.FEEDBACK_PROMPT)) {
            const t = setTimeout(() => {
                setShowFeedback(true);
                localStorage.setItem(STORAGE_KEYS.FEEDBACK_PROMPT, 'true');
            }, 3000);
            return () => clearTimeout(t);
        }
    }, [activeConnection]);

    // Track whether ConnectionContext has completed its first load.
    // Until that happens, we must NOT redirect — activeConnection is null
    // simply because the API hasn't responded yet, not because there's no connection.
    const connectionsInitialized = useRef(false);
    useEffect(() => {
        if (!connectionsLoading) connectionsInitialized.current = true;
    }, [connectionsLoading]);

    // Track the previous activeConnection id to detect actual connection *changes*
    // (switch/delete), as opposed to first-load resolution.
    const prevConnectionId = useRef(activeConnection?.id ?? '__initial__');

    // Auto-navigate to appropriate overview tab when connection changes
    // This ensures users see the right dashboard after switching databases
    // Also redirects to connections tab when no connection exists and user is on a connection-dependent tab
    useEffect(() => {
        // Don't redirect while connections are still loading from the backend
        if (!connectionsInitialized.current) return;

        // No connection → only demo tabs, connections, and user management are allowed
        if (!activeConnection) {
            if (activeTab?.startsWith('demo-')) return;
            if (activeTab === 'connections') return;
            if (activeTab === 'UserManagement' || activeTab === 'user-audit') return;
            setActiveTab('connections');
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 'connections');
            } catch {}
            prevConnectionId.current = null;
            return;
        }

        const dbType = activeConnection.dbType?.toLowerCase();
        let targetTab = 'overview'; // Default to PostgreSQL overview

        if (dbType === 'mysql' || dbType === 'mariadb') {
            targetTab = 'mysql-overview';
        } else if (dbType === 'mongodb') {
            targetTab = 'mongo-overview';
        } else if (dbType && PHASE5_DEMO_TABS[dbType]) {
            targetTab = PHASE5_DEMO_TABS[dbType];
        }

        // Only auto-navigate when the connection actually CHANGES (user switched DBs),
        // NOT on initial page load where we should respect the saved tab.
        const connectionChanged =
            prevConnectionId.current !== '__initial__' && prevConnectionId.current !== activeConnection.id;
        prevConnectionId.current = activeConnection.id;

        if (!connectionChanged) return; // On page load, stay on the saved tab

        // Only navigate if we're not already on a relevant tab for this connection
        // This avoids jarring navigation if user is already viewing a universal tab (like Alerts)
        const isRelevantTab = (tabId) => {
            // Always allow demo tabs and connections
            if (tabId?.startsWith('demo-')) return true;
            if (tabId === 'connections') return true;
            // Always allow universal sections
            const universalSections = [
                'Overview',
                'Alerts & Rules',
                'Security',
                'Observability',
                'Developer Tools',
                'User Management',
                'Admin',
                'Connections',
            ];
            const currentSection = SECTION_GROUPS.find((g) => g.tabs.some((t) => t.id === tabId))?.section;
            if (universalSections.includes(currentSection)) return true;

            // For DB-specific tabs, only allow if they match current connection
            if (
                dbType === 'postgresql' &&
                ['Query Analysis', 'Schema & Data', 'Infrastructure'].includes(currentSection)
            )
                return true;
            if ((dbType === 'mysql' || dbType === 'mariadb') && currentSection === 'MySQL') return true;
            if (dbType === 'mongodb' && currentSection === 'MongoDB') return true;
            return false;
        };

        // Only auto-navigate if current tab is not relevant for this connection
        if (!isRelevantTab(activeTab)) {
            setActiveTab(targetTab);
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, targetTab);
            } catch {}
        }
    }, [connectionsLoading, activeConnection?.id, activeTab]); // Re-run when loading finishes, connection changes, or tab changes

    // Demo users (username contains "demo_user") are locked to the Demo section
    // only — every other tab is hidden from them across the whole app.
    const isDemoUser = useMemo(() => (currentUser?.username || '').toLowerCase().includes('demo_user'), [currentUser]);

    const allowedTabIds = useMemo(
        () =>
            TABS_ONLY.filter((t) => {
                // Demo users: ONLY demo tabs are ever allowed.
                if (isDemoUser) return t.id.startsWith('demo-');
                // Demo tabs are always visible for any logged-in user
                if (t.id.startsWith('demo-')) return true;
                // If user is logged in, show all tabs
                if (currentUser) return true;
                // Fallback: check allowedScreens
                return (currentUser?.allowedScreens || []).includes(t.id);
            }).map((t) => t.id),
        [currentUser, isDemoUser],
    );

    const ActiveComponent = useMemo(() => {
        const tab = TABS_ONLY.find((t) => t.id === activeTab && allowedTabIds.includes(t.id));
        if (tab) return tab.component;
        return TABS_ONLY.find((t) => allowedTabIds.includes(t.id))?.component;
    }, [activeTab, allowedTabIds]);

    const activeTabMeta = useMemo(() => TABS_ONLY.find((t) => t.id === activeTab), [activeTab]);
    const accent = useMemo(() => getSectionAccent(activeTab), [activeTab]);
    const isDemoFullPage = activeTab?.startsWith('demo-');

    const handleTabChange = useCallback(
        (id) => {
            prevTabRef.current = activeTab;
            setActiveTab(id);
            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, id);
            } catch {}
        },
        [activeTab],
    );

    const handleToggleCollapse = useCallback(() => {
        setSidebarCollapsed((p) => {
            const v = !p;
            try {
                localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, v.toString());
            } catch {}
            return v;
        });
    }, []);

    const handleDismissNotification = useCallback((id) => setNotifications((p) => p.filter((n) => n.id !== id)), []);
    const handleClearAllNotifications = useCallback(() => setNotifications([]), []);

    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

    /* Keyboard shortcuts: Ctrl+B (sidebar), Ctrl+K (search), Ctrl+? (help), etc. */
    useEffect(() => {
        const handler = (e) => {
            const isMod = e.ctrlKey || e.metaKey;

            // Escape: Close help dialog if open
            if (e.key === 'Escape' && showKeyboardHelp) {
                e.preventDefault();
                setShowKeyboardHelp(false);
                return;
            }

            // Ctrl+B: Toggle sidebar
            if (isMod && e.key === 'b') {
                e.preventDefault();
                handleToggleCollapse();
            }
            // Ctrl+?: Show keyboard help
            else if (isMod && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
                e.preventDefault();
                setShowKeyboardHelp((prev) => !prev);
            }
            // Ctrl+O: Go to overview
            else if (isMod && e.key === 'o') {
                e.preventDefault();
                handleTabChange('overview');
            }
            // Ctrl+Shift+D: Toggle demo mode
            else if (isMod && e.shiftKey && e.key === 'd') {
                e.preventDefault();
                // Demo mode toggle would be handled by DemoContext
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleToggleCollapse, handleTabChange, showKeyboardHelp]);

    return (
        <NavigationContext.Provider value={{ goToTab: handleTabChange }}>
            <div
                style={{
                    display: 'flex',
                    height: '100vh',
                    width: '100%',
                    background: isDemoFullPage ? THEME.surfaceHover : DS.bg,
                    color: isDemoFullPage ? THEME.bg : DS.textPrimary,
                    overflow: 'hidden',
                    fontFamily: DS.fontUI,
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <AppStyles />
                <ChartDefs />
                <AmbientOrbs />

                {!isDemoFullPage && (
                    <Sidebar
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        onLogout={logout}
                        currentUser={profileUser}
                        collapsed={sidebarCollapsed}
                        onToggleCollapse={handleToggleCollapse}
                        onOpenFeedback={() => setShowFeedback(true)}
                        onOpenProfile={() => setShowProfile(true)}
                        allowedTabIds={allowedTabIds}
                    />
                )}

                <main
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {/* ── TOP HEADER ── */}
                    <header
                        style={{
                            height: isDemoFullPage ? 0 : 54,
                            flexShrink: 0,
                            borderBottom: isDemoFullPage ? 'none' : `1px solid ${DS.border}`,
                            display: isDemoFullPage ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 24px',
                            background: DS.headerBg,
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            position: 'sticky',
                            top: 0,
                            zIndex: 40,
                        }}
                    >
                        {/* Clean bottom border — no animation */}

                        {/* Left: breadcrumb + reconnecting */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            {/* Breadcrumb navigation — shows current section / tab */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            color: DS.textMuted,
                                            fontFamily: DS.fontMono,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        {getSectionForTab(activeTab) || 'Core'}
                                    </span>
                                    <span style={{ color: DS.textMuted, fontSize: 13 }}>/</span>
                                    <h2
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            margin: 0,
                                            color: DS.textPrimary,
                                            letterSpacing: '-0.01em',
                                        }}
                                    >
                                        {activeTabMeta?.label || ''}
                                    </h2>
                                </div>
                            </div>

                            {reconnecting && (
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: DS.amber,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 10px',
                                        background: 'rgba(251,191,36,0.08)',
                                        borderRadius: 20,
                                        border: '1px solid rgba(251,191,36,0.25)',
                                        fontFamily: DS.fontMono,
                                    }}
                                >
                                    <WifiOff size={12} style={{ animation: 'pulse 1.5s infinite' }} />
                                    RECONNECTING…
                                </div>
                            )}
                        </div>

                        {/* Right: connection switcher + status + refresh + bell + theme */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Suspense fallback={<ConnectionSelector />}>
                                <ConnectionSwitcherLazy />
                            </Suspense>
                            <Suspense fallback={null}>
                                <DatabaseSwitcherLazy />
                            </Suspense>
                            <div style={{ width: 1, height: 24, background: DS.border }} />
                            <GlobalRefreshButton />
                            <ThemeToggle />
                            <StatusPill connected={connected} />
                            <NotificationCenter
                                notifications={notifications}
                                onDismiss={handleDismissNotification}
                                onClearAll={handleClearAllNotifications}
                            />
                        </div>
                    </header>

                    {/* Demo mode banner removed — live data only */}

                    {/* ── MAIN CONTENT ── */}
                    <div
                        className="main-scroll"
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            position: 'relative',
                            background: isDemoFullPage ? 'transparent' : DS.bg,
                        }}
                    >
                        {/* Floating alert toast */}
                        {latestAlert && (
                            <div
                                style={{
                                    position: 'fixed',
                                    top: 78,
                                    right: 28,
                                    zIndex: 200,
                                    width: 380,
                                    animation: 'slideInRight 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                                }}
                            >
                                <div
                                    style={{
                                        background: DS.surface,
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        border: `1px solid ${SEV_COLORS[latestAlert.severity] || DS.cyan}50`,
                                        boxShadow: DS.shadowCard,
                                    }}
                                >
                                    <div
                                        style={{ height: 2.5, background: SEV_COLORS[latestAlert.severity] || DS.cyan }}
                                    />
                                    <AlertBanner alert={latestAlert} onDismiss={() => setLatestAlert(null)} />
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                padding: isDemoFullPage ? 0 : '16px 20px',
                                width: '100%',
                                minHeight: '100%',
                                position: 'relative',
                            }}
                        >
                            <ErrorBoundary key={activeTab}>
                                <Suspense
                                    fallback={
                                        <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
                                            {/* Enhanced loading state with skeleton cards */}
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                                    gap: 16,
                                                    marginBottom: 24,
                                                }}
                                            >
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            height: 160,
                                                            borderRadius: 12,
                                                            background: `linear-gradient(90deg, ${DS.surface} 0%, ${DS.surfaceHover} 50%, ${DS.surface} 100%)`,
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 2s infinite',
                                                            border: `1px solid ${DS.border}`,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div
                                                style={{
                                                    height: 300,
                                                    borderRadius: 12,
                                                    background: `linear-gradient(90deg, ${DS.surface} 0%, ${DS.surfaceHover} 50%, ${DS.surface} 100%)`,
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 2s infinite',
                                                    border: `1px solid ${DS.border}`,
                                                }}
                                            />
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginTop: 24,
                                                    gap: 12,
                                                    color: DS.textMuted,
                                                    fontFamily: DS.fontUI,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: '50%',
                                                        border: `2px solid ${DS.border}`,
                                                        borderTopColor: DS.cyan,
                                                        animation: 'rotate 0.9s linear infinite',
                                                    }}
                                                />
                                                <span style={{ fontSize: 13 }}>Loading tab…</span>
                                            </div>
                                        </div>
                                    }
                                >
                                    <div
                                        key={activeTab}
                                        className="tab-mount"
                                        role="tabpanel"
                                        aria-labelledby={`${activeTab}-tab`}
                                    >
                                        <SectionErrorBoundary
                                            sectionName={activeTabMeta?.label || activeTab}
                                            key={activeTab}
                                        >
                                            {ActiveComponent && <ActiveComponent tabId={activeTab} />}
                                        </SectionErrorBoundary>
                                    </div>
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </div>
                </main>

                {showFeedback && activeConnection && (
                    <FeedbackModal onClose={() => setShowFeedback(false)} initialSection={activeTab} />
                )}
                {showProfile && (
                    <ProfileModal
                        user={profileUser}
                        onClose={() => setShowProfile(false)}
                        onSave={(u) => setProfileUser(u)}
                    />
                )}

                {/* Keyboard Shortcuts Help Modal */}
                {showKeyboardHelp && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.75)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'fadeIn 0.2s ease-out',
                        }}
                        onClick={(e) => e.target === e.currentTarget && setShowKeyboardHelp(false)}
                    >
                        <div
                            style={{
                                background: DS.surface,
                                border: `1px solid ${DS.borderAccent}`,
                                borderRadius: 16,
                                width: 520,
                                maxWidth: '90vw',
                                maxHeight: '80vh',
                                boxShadow: `${DS.shadowDeep}`,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                animation: 'slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    padding: '20px 26px 18px',
                                    borderBottom: `1px solid ${DS.border}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <h3
                                        style={{
                                            margin: '0 0 4px',
                                            fontSize: 17,
                                            fontWeight: 700,
                                            color: DS.textPrimary,
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        Keyboard Shortcuts
                                    </h3>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 11,
                                            color: DS.textMuted,
                                            fontFamily: DS.fontMono,
                                            letterSpacing: '0.02em',
                                        }}
                                    >
                                        Press Ctrl+? anytime to toggle this dialog
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowKeyboardHelp(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${DS.border}`,
                                        color: DS.textSub,
                                        cursor: 'pointer',
                                        width: 32,
                                        height: 32,
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                                        e.currentTarget.style.color = DS.rose;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                        e.currentTarget.style.color = DS.textSub;
                                    }}
                                >
                                    <X size={15} strokeWidth={2} />
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                    {/* Navigation */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                letterSpacing: '0.02em',
                                                color: DS.cyan,
                                                marginBottom: 12,
                                            }}
                                        >
                                            Navigation
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+B
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Toggle sidebar</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+K
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Focus search</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+O
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Go to Overview</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                letterSpacing: '0.02em',
                                                color: DS.emerald,
                                                marginBottom: 12,
                                            }}
                                        >
                                            Other
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Ctrl+?
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>Show this help</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <kbd
                                                    style={{
                                                        fontSize: 11,
                                                        color: DS.textMuted,
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: `1px solid ${DS.border}`,
                                                        padding: '4px 8px',
                                                        borderRadius: 14,
                                                        fontFamily: DS.fontMono,
                                                    }}
                                                >
                                                    Esc
                                                </kbd>
                                                <span style={{ fontSize: 12, color: DS.textSub }}>
                                                    Close this dialog
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        marginTop: 20,
                                        padding: '12px 14px',
                                        background: `${DS.cyan}10`,
                                        border: `1px solid ${DS.cyan}30`,
                                        borderRadius: 8,
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: 12, color: DS.textSub, lineHeight: 1.5 }}>
                                        Tip: Use the search bar (Ctrl+K) to quickly find tabs by name.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Command Palette (Ctrl+K) */}
                <CommandPalette />
            </div>
        </NavigationContext.Provider>
    );
};
