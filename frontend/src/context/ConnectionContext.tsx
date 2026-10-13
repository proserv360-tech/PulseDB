/**
 * ConnectionContext — provides the currently-active database connection
 * to any component in the tree without prop drilling.
 *
 * IMPORTANT: On page refresh, connections and activeConnection are hydrated
 * from localStorage IMMEDIATELY so every component sees them on the very
 * first render. The API call then updates/confirms the data in the background.
 * This eliminates the "flash of empty state" across all screens.
 *
 * Usage:
 *   const { activeConnectionId, setActiveConnectionId, connections, activeConnection } = useConnection();
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { fetchData, postData, setActiveConnectionId as persistConnectionId } from '../utils/api';

const ConnectionContext = createContext(null);

// ── LocalStorage cache helpers ──────────────────────────────────────────
const CACHE_KEYS = {
    CONNECTIONS: 'pulsedb_cached_connections',
    ACTIVE_ID: 'pulsedb_active_connection_id',
};

function readCachedConnections() {
    try {
        const raw = localStorage.getItem(CACHE_KEYS.CONNECTIONS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function writeCachedConnections(conns) {
    try {
        localStorage.setItem(CACHE_KEYS.CONNECTIONS, JSON.stringify(conns));
    } catch {}
}

function readCachedActiveId() {
    try {
        const saved = localStorage.getItem(CACHE_KEYS.ACTIVE_ID);
        if (!saved) return null;
        const n = parseInt(saved, 10);
        return isNaN(n) ? null : n;
    } catch { return null; }
}

// ── Provider ────────────────────────────────────────────────────────────

export function ConnectionProvider({ children }) {
    // Hydrate BOTH connections list AND activeConnectionId from localStorage
    // so activeConnection resolves on the very first render (no null flash)
    const [connections, setConnectionsRaw] = useState(readCachedConnections);
    const [activeConnectionId, setActiveConnectionIdState] = useState(readCachedActiveId);
    const [loading, setLoading] = useState(true);

    // Wrapper that also persists to localStorage whenever connections change
    const setConnections = useCallback((conns) => {
        const list = Array.isArray(conns) ? conns : [];
        setConnectionsRaw(list);
        writeCachedConnections(list);
    }, []);

    // Load connections + current active from backend on mount
    useEffect(() => {
        async function load() {
            try {
                const [conns, active] = await Promise.all([
                    fetchData('/api/connections'),
                    fetchData('/api/connections/active'),
                ]);
                const connList = Array.isArray(conns) ? conns : [];
                setConnections(connList);

                const defaultConn = connList.find(c => c.isDefault) || connList[0];
                const resolvedId = active?.connectionId ?? defaultConn?.id ?? null;
                setActiveConnectionIdState(resolvedId);
                persistConnectionId(resolvedId);
            } catch (err) {
                console.warn('[ConnectionContext] Failed to load connections:', err?.message ?? err);
                // On error, DON'T clear the cached connections — keep showing stale data
                // so the UI doesn't flash empty. The user can still navigate.
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    /** Switch the active connection — calls backend and updates local state */
    const switchConnection = useCallback(async (id) => {
        try {
            const data = await postData(`/api/connections/${id}/switch`);
            if (data.success) {
                setActiveConnectionIdState(id);
                persistConnectionId(id);
                const conns = await fetchData('/api/connections');
                setConnections(Array.isArray(conns) ? conns : []);
            }
            return data;
        } catch (err) {
            console.error('[ConnectionContext] switchConnection failed:', err?.message ?? err);
            throw err;
        }
    }, [setConnections]);

    /** Refresh connections list + active connection (called after add/edit/delete) */
    const refreshConnections = useCallback(async () => {
        try {
            const [conns, active] = await Promise.all([
                fetchData('/api/connections'),
                fetchData('/api/connections/active'),
            ]);
            const connList = Array.isArray(conns) ? conns : [];
            setConnections(connList);

            if (active?.connectionId) {
                setActiveConnectionIdState(active.connectionId);
                persistConnectionId(active.connectionId);
            }
        } catch {}
    }, [setConnections]);

    // PERF / robustness: if activeConnectionId points to a connection that
    // is no longer in the list (deleted on the server, stale localStorage
    // value after re-login, restart that lost the in-memory per-user map),
    // fall back to the connection flagged isDefault, then to the first
    // available. This prevents the header from being stuck on "Connecting…"
    // after a backend restart.
    const activeConnection =
        connections.find(c => c.id === activeConnectionId) ??
        connections.find(c => c.isDefault) ??
        connections[0] ??
        null;

    // If we had to fall back, persist the resolved id so the next render is
    // consistent and the backend learns this user's choice on the next
    // /switch or fetch.
    useEffect(() => {
        if (!loading && activeConnection && activeConnection.id !== activeConnectionId) {
            setActiveConnectionIdState(activeConnection.id);
            persistConnectionId(activeConnection.id);
        }
    }, [loading, activeConnection, activeConnectionId]);

    // Persist dbType for sidebar stability (used by Sidebar component)
    useEffect(() => {
        if (activeConnection?.dbType) {
            try { localStorage.setItem('pulsedb_last_db_type', activeConnection.dbType); } catch {}
        }
    }, [activeConnection?.dbType]);

    // Memoize context value to prevent unnecessary re-renders of all consumers
    const value = useMemo(() => ({
        connections,
        activeConnectionId,
        activeConnection,
        loading,
        switchConnection,
        refreshConnections,
        setActiveConnectionId: setActiveConnectionIdState,
    }), [connections, activeConnectionId, activeConnection, loading, switchConnection, refreshConnections, setActiveConnectionIdState]);

    return (
        <ConnectionContext.Provider value={value}>
            {children}
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    const ctx = useContext(ConnectionContext);
    if (!ctx) throw new Error('useConnection must be used inside <ConnectionProvider>');
    return ctx;
}
