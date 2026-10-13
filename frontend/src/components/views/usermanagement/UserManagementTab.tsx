import React, {
    useState, useCallback, useEffect, useReducer,
    useRef, useMemo, createContext, useContext, memo,
} from 'react';
import { createPortal } from 'react-dom';

import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { UsersTable, PermissionMatrix } from './Toggle/TableAndMatrix';
import { AuditLog, SecurityPanel } from './PermissionMatrix/AuditAndSecurity';
import { UserDrawer, PasswordModal, UserFormModal } from './PermissionMatrix/Modals';

const T = THEME;
const API_BASE = import.meta.env.VITE_API_URL || '';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 1 — CONSTANTS
═══════════════════════════════════════════════════════════════════════════ */
const TABS = Object.freeze([
    { id: 'users',    label: 'Users',       icon: '👥', shortcut: '1' },
    { id: 'matrix',   label: 'Permissions', icon: '🛡️', shortcut: '2' },
    { id: 'audit',    label: 'Audit Log',   icon: '📋', shortcut: '3' },
    { id: 'security', label: 'Security',    icon: '🔒', shortcut: '4' },
]);
const TAB_IDS = TABS.map(t => t.id);

const ICONS = {
    alert:    (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    refresh:  (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    plus:     (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    x:        (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    trash:    (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    pause:    (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
    check:    (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    users:    (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    shield:   (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    activity: (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    lock:     (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    edit:     (sz, c) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
};

const Ico = memo(({ name, size = 16, color = 'currentColor', style = {} }) => {
    const render = ICONS[name];
    if (!render) return null;
    return <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, ...style }}>{render(size, color)}</span>;
});
Ico.displayName = 'Ico';

const MODAL = Object.freeze({
    NONE:     { type: 'NONE' },
    DRAWER:   (user)    => ({ type: 'DRAWER', user }),
    EDIT:     (user)    => ({ type: 'EDIT', user }),
    PASSWORD: (user)    => ({ type: 'PASSWORD', user }),
    CONFIRM:  (payload) => ({ type: 'CONFIRM', ...payload }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 2 — STATE MACHINE
═══════════════════════════════════════════════════════════════════════════ */
const initialState = {
    activeTab:     'users',
    modal:         MODAL.NONE,
    prevTab:       null,
    tabHistory:    ['users'],
    bulkSelection: new Set(),
    searchQuery:   '',
    sortConfig:    { key: 'name', direction: 'asc' },
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_TAB': {
            if (state.activeTab === action.tab) return state;
            const history = [...state.tabHistory, action.tab].slice(-10);
            return { ...state, prevTab: state.activeTab, activeTab: action.tab, tabHistory: history, bulkSelection: new Set(), searchQuery: '' };
        }
        case 'OPEN_MODAL':         return { ...state, modal: action.modal };
        case 'CLOSE_MODAL':        return { ...state, modal: MODAL.NONE };
        case 'TOGGLE_BULK_SELECT': {
            const next = new Set(state.bulkSelection);
            if (next.has(action.id)) next.delete(action.id); else next.add(action.id);
            return { ...state, bulkSelection: next };
        }
        case 'SELECT_ALL_BULK':    return { ...state, bulkSelection: new Set(action.ids) };
        case 'CLEAR_BULK':         return { ...state, bulkSelection: new Set() };
        case 'SET_SEARCH':         return { ...state, searchQuery: action.query };
        case 'SET_SORT': {
            const direction = state.sortConfig.key === action.key && state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
            return { ...state, sortConfig: { key: action.key, direction } };
        }
        default: return state;
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 3 — CONTEXT
═══════════════════════════════════════════════════════════════════════════ */
const UserMgmtContext = createContext(null);
export const useUserMgmt = () => {
    const ctx = useContext(UserMgmtContext);
    if (!ctx) throw new Error('useUserMgmt must be used within <UserManagementTab>');
    return ctx;
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 4 — CUSTOM HOOKS
═══════════════════════════════════════════════════════════════════════════ */
function useToast() {
    const [toasts, setToasts] = useState([]);
    const toast = useCallback((message, type = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);
    return { toasts, toast };
}

function useUsers(initialUsers = []) {
    const [users, setUsers]     = useState(initialUsers);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const abortRef              = useRef(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('pulsedb_token');
        return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    }, []);

    const fetchUsers = useCallback(async () => {
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true); setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/users`, { headers: getAuthHeaders(), signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : data.users || []);
        } catch (err) {
            if (err.name !== 'AbortError') setError(err.message || 'Failed to fetch users');
        } finally { setLoading(false); }
    }, [getAuthHeaders]);

    const createUser = useCallback(async (formData) => {
        const res = await fetch(`${API_BASE}/api/users`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(formData) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
        const created = await res.json();
        setUsers(prev => [...prev, created.user || created]);
        return created.user || created;
    }, [getAuthHeaders]);

    const updateUser = useCallback(async (id, formData) => {
        const numId = Number(id);
        if (isNaN(numId)) { throw new Error(`Invalid user ID: ${id}`); }
        const prev = users;
        setUsers(u => u.map(x => x.id === numId ? { ...x, ...formData, id: numId } : x));
        try {
            const res = await fetch(`${API_BASE}/api/users/${numId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(formData) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
            const updated = await res.json();
            setUsers(u => u.map(x => x.id === numId ? (updated.user || updated) : x));
            setTimeout(() => fetchUsers(), 500);
        } catch (err) { setUsers(prev); throw err; }
    }, [getAuthHeaders, users, fetchUsers]);

    const deleteUsers = useCallback(async (ids) => {
        const prev = users;
        setUsers(u => u.filter(x => !ids.includes(x.id)));
        try {
            await Promise.all(ids.map(id =>
                fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
                    .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
            ));
        } catch (err) { setUsers(prev); throw err; }
    }, [getAuthHeaders, users]);

    const resetPassword = useCallback(async (userId, newPassword) => {
        const res = await fetch(`${API_BASE}/api/users/${userId}/reset-password`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ newPassword }) });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
    }, [getAuthHeaders]);

    useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);
    return { users, loading, error, fetchUsers, createUser, updateUser, deleteUsers, resetPassword, setUsers };
}

function useStaleWhileRevalidate(users, fetchUsers) {
    const [isRevalidating, setIsRevalidating] = useState(false);
    const hasCached = useRef(false);
    useEffect(() => { if (users.length > 0) hasCached.current = true; }, [users.length]);
    const revalidate = useCallback(async () => {
        if (hasCached.current) { setIsRevalidating(true); await fetchUsers(); setIsRevalidating(false); }
        else { await fetchUsers(); }
    }, [fetchUsers]);
    return { isRevalidating, revalidate };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 5 — GLOBAL STYLES
═══════════════════════════════════════════════════════════════════════════ */
const GlobalStylesInjector = () => (
    <style>{`
    @keyframes umSlideUp    { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
    @keyframes umFade       { from { opacity:0 } to { opacity:1 } }
    @keyframes umFadeIn     { from { opacity:0 } to { opacity:1 } }
    @keyframes umSpin       { to { transform:rotate(360deg) } }
    @keyframes umShimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
    @keyframes umLivePulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }

    .um-root *, .um-root *::before, .um-root *::after { box-sizing: border-box; }
    .shimmer-skeleton { background: linear-gradient(90deg, ${T.surfaceRaised} 25%, ${T.grid} 50%, ${T.surfaceRaised} 75%); background-size: 200% 100%; animation: umShimmer 1.5s infinite ease-in-out; border-radius: 22px; }
    .um-revalidating-bar { position:absolute; top:0; left:0; right:0; height:2px; background: linear-gradient(90deg, transparent, ${T.primary}, transparent); background-size:200% 100%; animation:umShimmer 1s infinite linear; border-radius:2px; z-index:10; }
    .um-live-dot { width:8px; height:8px; border-radius:50%; background:${T.success}; animation:umLivePulse 2s ease-in-out infinite; display:inline-block; flex-shrink:0; }
    
    .um-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius: 20px; border:none; font-size:12px; font-weight:600; cursor:pointer; transition:all .15s ease; font-family:inherit; line-height:1; }
    .um-btn:disabled { opacity:.5; cursor:not-allowed; }
    .um-btn-primary  { background:${T.primary}; color:${T.textInverse}; }
    .um-btn-primary:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-3px); }
    .um-btn-ghost    { background:transparent; color:${T.textDim}; border:1px solid ${T.glassBorder}; }
    .um-btn-ghost:hover:not(:disabled) { background:${T.surfaceHover}; color:${T.textMain}; }
    .um-btn-danger   { background:${T.danger}; color:#fff; }
    .um-btn-danger:hover:not(:disabled) { filter:brightness(1.1); }
    .um-btn-sm   { padding:5px 10px; font-size:12px; }
    .um-btn-icon { padding:6px; border-radius: 22px; display:inline-flex; align-items:center; justify-content:center; }

    .um-tab { display:inline-flex; align-items:center; gap:6px; padding:12px 16px; border:none; background:transparent; color:${T.textMuted}; font-size:12px; font-weight:500; cursor:pointer; transition:color .15s; font-family:inherit; position:relative; }
    .um-tab:hover  { color:${T.textMain}; }
    .um-tab.active { color:${T.primary}; font-weight:700; }
    .um-tab.active::after { content:''; position:absolute; bottom:0; left:12px; right:12px; height:2px; background:${T.primary}; border-radius:2px; }

    .um-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap: 20px; }
    .um-grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap: 20px; }
    @media(max-width:900px){ .um-grid-4{ grid-template-columns:repeat(2,1fr); } }
    @media(max-width:600px){ .um-grid-4,.um-grid-2{ grid-template-columns:1fr; } }
    .um-scroll { overflow-y:auto; scrollbar-width:thin; scrollbar-color:${T.glassBorder} transparent; }
  `}</style>
);
GlobalStylesInjector.displayName = 'GlobalStylesInjector';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 — TOAST & ERROR
═══════════════════════════════════════════════════════════════════════════ */
const ToastContainer = memo(({ toasts }) => {
    if (!toasts.length) return null;
    return createPortal(
        <div style={{ position:'fixed', top:20, right:20, zIndex:600, display:'flex', flexDirection:'column', gap: 20 }} aria-live="polite">
            {toasts.map(t => (
                <div key={t.id} style={{
                    padding:'10px 16px', borderRadius: 16, fontSize:13, fontWeight:500, color:'#fff', maxWidth:360,
                    background: t.type === 'error' ? (T.danger) : (T.primary),
                    boxShadow:T.shadowLg, animation:'umSlideUp .2s ease-out',
                    display:'flex', alignItems:'center', gap: 20,
                }}>
                    <Ico name={t.type === 'error' ? 'alert' : 'check'} size={14} color="#fff" />
                    {t.message}
                </div>
            ))}
        </div>,
        document.body
    );
});
ToastContainer.displayName = 'ToastContainer';

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7 — CONFIRM PORTAL
═══════════════════════════════════════════════════════════════════════════ */
const ModalPortal = memo(({ children, isOpen }) => {
    if (!isOpen) return null;
    return createPortal(children, document.body);
});

const ConfirmDialog = memo(({ title, message, confirmLabel, variant = 'danger', onConfirm, onCancel }) => {
    return (
        <div
            onClick={e => e.target === e.currentTarget && onCancel()}
            style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)' }}
        >
            <div style={{ background:T.surface, border:`1px solid ${T.glassBorder}`, borderRadius:16, padding:'24px 28px', maxWidth:420, width:'90vw', boxShadow:T.shadowMd, animation:'umSlideUp .2s ease' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap: 18, marginBottom:18 }}>
                    <div style={{ width:38, height:38, borderRadius: 20, flexShrink:0, background:variant === 'danger' ? `${T.danger}18` : `${T.primary}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Ico name={variant === 'danger' ? 'alert' : 'check'} size={18} color={variant === 'danger' ? (T.danger) : (T.primary)} />
                    </div>
                    <div>
                        <div style={{ fontSize:15, fontWeight:700, color:T.textMain }}>{title}</div>
                        <div style={{ fontSize:12, color:T.textDim, marginTop:6, lineHeight:1.6 }}>{message}</div>
                    </div>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap: 22 }}>
                    <button className="um-btn um-btn-ghost" onClick={onCancel}>Cancel</button>
                    <button className={`um-btn ${variant === 'danger' ? 'um-btn-danger' : 'um-btn-primary'}`} onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
                </div>
            </div>
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 8 — TAB COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */
const TabPanel = memo(({ activeTab, children }) => {
    return (
        <div role="tabpanel" style={{ padding:20, animation: 'umFade 0.2s ease-out' }}>
            {children}
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 9 — ROOT COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const UserManagementTab = ({ initialUsers = [] }) => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [state, dispatch] = useReducer(reducer, initialState);
    const { activeTab, modal, bulkSelection } = state;
    const { toasts, toast }    = useToast();
    const { users, loading, error, fetchUsers, createUser, updateUser, deleteUsers, resetPassword, setUsers } = useUsers(initialUsers);
    const { isRevalidating, revalidate } = useStaleWhileRevalidate(users, fetchUsers);

    // Real-time polling and WebSocket
    const wsRef = useRef(null);
    const [isLive, setIsLive] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);
    const pollingRef = useRef(null);

    // Format time elapsed
    const formatTimeAgo = useCallback((timestamp) => {
        if (!timestamp) return 'never';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        return `${Math.floor(seconds / 3600)}h`;
    }, []);

    // Polling-based live sync (replaces WebSocket — not supported on Vercel)
    useEffect(() => {
        setIsLive(true);
        pollingRef.current = setInterval(() => {
            fetchUsers();
            setLastSynced(Date.now());
        }, 30000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [fetchUsers]);

    // Initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (initialUsers.length === 0) fetchUsers(); }, []);

    const activeCount  = useMemo(() => users.filter(u => u.status === 'active').length, [users]);
    const bulkCount    = bulkSelection.size;
    const contextValue = useMemo(() => ({ state, dispatch, users, toast, setUsers }), [state, users, toast, setUsers]);

    const handleSaveUser = useCallback(async (formData) => {
        const hasId = formData.id != null && !isNaN(formData.id);
        try {
            if (hasId) {
                await updateUser(Number(formData.id), formData);
                toast(`${formData.name} updated successfully`);
            } else {
                const created = await createUser(formData);
                toast(`${created?.name ?? formData.name} created successfully`);
            }
            dispatch({ type: 'CLOSE_MODAL' });
        } catch (err) { console.error('[handleSaveUser] error', err); toast(err.message || 'Save failed', 'error'); }
    }, [updateUser, createUser, toast]);

    const handleDeleteUsers = useCallback(async (ids) => {
        const arr = Array.isArray(ids) ? ids : [ids];
        const count = arr.length;
        dispatch({ type:'OPEN_MODAL', modal: MODAL.CONFIRM({
                title: `Delete ${count} user${count > 1 ? 's' : ''} ?`,
                message: 'This action cannot be undone.',
                confirmLabel: 'Delete',
                variant: 'danger',
                onConfirm: async () => {
                    try { await deleteUsers(arr); toast(`${count} user${count > 1 ? 's' : ''} removed`); dispatch({ type:'CLOSE_MODAL' }); }
                    catch (err) { toast(err.message || 'Delete failed', 'error'); }
                },
            }) });
    }, [deleteUsers, toast]);

    const handleResetPassword = useCallback(async (userId, newPassword) => {
        try { await resetPassword(userId, newPassword); toast('Password updated successfully'); dispatch({ type:'CLOSE_MODAL' }); }
        catch (err) { toast(err.message || 'Password reset failed', 'error'); }
    }, [resetPassword, toast]);

    return (
        <UserMgmtContext.Provider value={contextValue}>
            <div className="um-root" style={{ padding:'24px 24px 40px', position:'relative' }}>
                <GlobalStylesInjector />
                <ToastContainer toasts={toasts} />
                {isRevalidating && <div className="um-revalidating-bar" />}

                {/* Header */}
                <header style={{ marginBottom:24, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap: 22 }}>
                    <div>
                        <h1 style={{ fontSize:24, fontWeight:900, color:T.textMain, margin:0, display:'flex', alignItems:'center', gap: 22 }}>
                            User Management
                            {isLive && <span className="um-live-dot" title="Live sync enabled" />}
                        </h1>
                        <div style={{ fontSize:12, color:T.textDim, marginTop:4 }}>
                            Manage access, permissions, and security across your organization
                            {lastSynced && <span style={{ marginLeft: '8px' }}>• Last synced {formatTimeAgo(lastSynced)} ago</span>}
                        </div>
                    </div>
                    <div style={{ display:'flex', gap: 22, alignItems:'center' }}>
                        <div style={{ fontSize:11, color:T.textDim, padding:'6px 12px', background:T.surfaceRaised, borderRadius: 20, border:`1px solid ${T.glassBorder}`, display:'flex', alignItems:'center', gap: 20, boxShadow:T.shadowMd }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background: activeCount > 0 ? THEME.success : (T.textMuted || THEME.textDim), display:'inline-block' }} />
                            {users.length} users · {activeCount} active
                        </div>
                        <button className="um-btn um-btn-ghost" onClick={revalidate} disabled={loading || isRevalidating} style={{ boxShadow:T.shadowMd }}>
                            <Ico name="refresh" size={13} style={loading ? { animation:'umSpin 1s linear infinite' } : {}} />
                            {loading || isRevalidating ? 'Loading' : 'Refresh'}
                        </button>
                        <button className="um-btn um-btn-primary" onClick={() => dispatch({ type:'OPEN_MODAL', modal:MODAL.EDIT(null) })} style={{ boxShadow:T.shadowMd }}>
                            <Ico name="plus" size={14} color="#fff" /> New User
                        </button>
                    </div>
                </header>

                {/* Error Block */}
                {error && (
                    <div role="alert" style={{ marginBottom:18, padding:'12px 16px', borderRadius:16, background:`${T.danger}08`, border:`1px solid ${T.danger}30`, display:'flex', alignItems:'center', gap: 18, color:T.danger, boxShadow:T.shadowMd }}>
                        <Ico name="alert" size={16} color={T.danger} />
                        <div style={{ flex:1 }}>{error}</div>
                    </div>
                )}

                {/* Main Card */}
                <div style={{ background:T.surface, border:`1px solid ${T.glassBorder}`, borderRadius:16, overflow:'visible', position:'relative', boxShadow:T.shadowMd }}>
                    <div style={{ display:'flex', borderBottom:`1px solid ${T.glassBorder}`, paddingLeft:8, background:T.surfaceRaised, borderRadius:'12px 12px 0 0' }}>
                        {TABS.map(t => (
                            <button key={t.id} className={`um-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => dispatch({ type:'SET_TAB', tab:t.id })}>
                                <Ico name={t.id === 'users' ? 'users' : t.id === 'matrix' ? 'shield' : t.id === 'audit' ? 'activity' : 'lock'} size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <TabPanel activeTab={activeTab}>
                        {activeTab === 'users'    && <UsersTable users={users} onSelectUser={u => dispatch({ type:'OPEN_MODAL', modal:MODAL.DRAWER(u) })} onDeleteUsers={handleDeleteUsers} onEditUser={u => dispatch({ type:'OPEN_MODAL', modal:MODAL.EDIT(u ?? null) })} />}
                        {activeTab === 'matrix'   && <PermissionMatrix />}
                        {activeTab === 'audit'    && <AuditLog />}
                        {activeTab === 'security' && <SecurityPanel users={users} />}
                    </TabPanel>
                </div>

                {/* MODALS — Handled directly by Modals.jsx */}
                {modal.type === 'EDIT' && (
                    <UserFormModal key={modal.user?.id ?? 'new'} user={modal.user} onSave={handleSaveUser} onCancel={() => dispatch({ type:'CLOSE_MODAL' })} />
                )}

                {modal.type === 'DRAWER' && (
                    <UserDrawer user={modal.user} onClose={() => dispatch({ type:'CLOSE_MODAL' })} onEdit={u => dispatch({ type:'OPEN_MODAL', modal:MODAL.EDIT(u) })} onResetPassword={u => dispatch({ type:'OPEN_MODAL', modal:MODAL.PASSWORD(u) })} />
                )}

                {modal.type === 'PASSWORD' && (
                    <PasswordModal user={modal.user} onConfirm={handleResetPassword} onClose={() => dispatch({ type:'CLOSE_MODAL' })} />
                )}

                <ModalPortal isOpen={modal.type === 'CONFIRM'}>
                    <ConfirmDialog title={modal.title} message={modal.message} confirmLabel={modal.confirmLabel} variant={modal.variant} onConfirm={modal.onConfirm} onCancel={() => dispatch({ type:'CLOSE_MODAL' })} />
                </ModalPortal>

            </div>
        </UserMgmtContext.Provider>
    );
};

export default memo(UserManagementTab);