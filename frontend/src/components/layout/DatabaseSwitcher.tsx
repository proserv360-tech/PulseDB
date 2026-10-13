/**
 * DatabaseSwitcher.tsx
 * Compact top-bar dropdown to switch the active database on the SAME server as
 * the current connection — without registering a new connection.
 *
 * A connection points at one database, but a server hosts many. This control
 * lists the databases on the active connection's server (Postgres pg_database,
 * MySQL SHOW DATABASES, MongoDB listDatabases) and lets the operator pick one.
 * The backend records a per-user, per-connection override and serves every
 * dashboard query from a pool bound to the selected database. After a switch we
 * invalidate the API cache so all panels refetch against the chosen database.
 *
 * Transaction-pooler connections (e.g. Supabase port 6543) can't be re-targeted
 * at runtime; the backend returns switchable:false and we render a disabled,
 * explanatory state instead of a live picker.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../utils/theme';
import { useConnection } from '../../context/ConnectionContext';
import { fetchDataFresh, postData, invalidateCache } from '../../utils/api';
import { Database, ChevronDown, Search, Check, Loader2, RefreshCw, Info } from 'lucide-react';

const SWITCHABLE_ENGINES = new Set(['postgresql', 'postgres', 'mysql', 'mariadb', 'mongodb']);

const canonicalEngine = (raw?: string) => {
    const t = (raw || 'postgresql').toLowerCase();
    if (t.includes('postgres')) return 'postgresql';
    if (t.includes('mysql') || t.includes('maria')) return 'mysql';
    if (t.includes('mongo')) return 'mongodb';
    return t;
};

const formatBytes = (n?: number | null) => {
    if (!n || n <= 0) return null;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const DatabaseSwitcher = () => {
    useAdaptiveTheme();
    const { activeConnectionId, activeConnection } = useConnection();

    const [isOpen, setIsOpen] = useState(false);
    const [databases, setDatabases] = useState<Array<{ name: string; sizeBytes?: number | null }>>([]);
    const [active, setActive] = useState<string | null>(null);
    const [switchable, setSwitchable] = useState(true);
    const [reason, setReason] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const engine = canonicalEngine(activeConnection?.dbType);
    const enabled = !!activeConnection && SWITCHABLE_ENGINES.has(engine);

    // Load current active database (+ switchable flag) whenever the connection changes.
    useEffect(() => {
        if (!enabled || !activeConnectionId) {
            setActive(null);
            setDatabases([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const d = await fetchDataFresh(`/api/connections/${activeConnectionId}/database`);
                if (cancelled) return;
                setActive(d?.active ?? activeConnection?.database ?? null);
                setSwitchable(d?.switchable !== false);
            } catch {
                if (!cancelled) setActive(activeConnection?.database ?? null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeConnectionId, enabled, activeConnection?.database]);

    const loadDatabases = useCallback(
        async (refresh = false) => {
            if (!activeConnectionId) return;
            setLoading(true);
            setError(null);
            try {
                const d = await fetchDataFresh(
                    `/api/connections/${activeConnectionId}/databases${refresh ? '?refresh=1' : ''}`,
                );
                setDatabases(Array.isArray(d?.databases) ? d.databases : []);
                setActive(d?.active ?? active);
                setSwitchable(d?.switchable !== false);
                setReason(d?.reason ?? null);
                if (d?.error) setError(d.error);
            } catch (err: any) {
                setError(err?.message ?? 'Failed to load databases');
            } finally {
                setLoading(false);
            }
        },
        [activeConnectionId, active],
    );

    // Close on outside click; focus search + load list on open.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        if (isOpen) {
            document.addEventListener('mousedown', onClick);
            if (!databases.length) loadDatabases(false);
            setTimeout(() => searchRef.current?.focus(), 50);
        }
        return () => document.removeEventListener('mousedown', onClick);
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelect = useCallback(
        async (dbName: string) => {
            if (dbName === active || !activeConnectionId) return;
            setSwitching(true);
            setError(null);
            try {
                const res = await postData(`/api/connections/${activeConnectionId}/database`, { database: dbName });
                if (res?.success) {
                    setActive(dbName);
                    setIsOpen(false);
                    setSearch('');
                    // Force every dashboard query to refetch against the new database.
                    invalidateCache();
                    window.dispatchEvent(new CustomEvent('fathom-refresh'));
                } else {
                    setError(res?.error ?? 'Switch failed');
                }
            } catch (err: any) {
                setError(err?.message ?? 'Switch failed');
            } finally {
                setSwitching(false);
            }
        },
        [active, activeConnectionId],
    );

    if (!enabled) return null;

    const filtered = databases.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <>
            <style>{`
                @keyframes dbSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
                .db-item { transition: background 0.12s ease; }
                .db-item:hover { background: ${THEME.surfaceHover}; }
            `}</style>

            <div style={styles.wrapper} ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen((o) => !o)}
                    disabled={switching}
                    style={{ ...styles.button, opacity: switching ? 0.6 : 1 }}
                    title={
                        switchable
                            ? `Database: ${active ?? '—'}`
                            : reason || 'Switching databases is not available on this connection'
                    }
                >
                    <div style={styles.iconWrapper}>
                        <Database size={14} color={THEME.primary} />
                    </div>
                    <span style={styles.label}>{active ?? 'database'}</span>
                    {switching ? (
                        <Loader2 size={14} style={{ animation: 'dbSpin 1s linear infinite' }} />
                    ) : (
                        <ChevronDown
                            size={14}
                            style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}
                        />
                    )}
                </button>

                {isOpen && (
                    <div style={styles.dropdown}>
                        <div style={styles.searchRow}>
                            <Search size={14} color={THEME.textMuted} />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Filter databases"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={styles.searchInput}
                            />
                            <button onClick={() => loadDatabases(true)} title="Refresh list" style={styles.refreshBtn}>
                                <RefreshCw
                                    size={13}
                                    color={THEME.textMuted}
                                    style={loading ? { animation: 'dbSpin 1s linear infinite' } : undefined}
                                />
                            </button>
                        </div>

                        {!switchable && (
                            <div style={styles.notice}>
                                <Info size={13} color={THEME.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>{reason || 'This connection cannot switch databases in place.'}</span>
                            </div>
                        )}

                        <div style={styles.list}>
                            {loading && !databases.length ? (
                                <div style={styles.empty}>Loading databases…</div>
                            ) : error ? (
                                <div style={{ ...styles.empty, color: THEME.danger || THEME.danger }}>{error}</div>
                            ) : filtered.length === 0 ? (
                                <div style={styles.empty}>No databases match</div>
                            ) : (
                                filtered.map((db) => {
                                    const isActive = db.name === active;
                                    const size = formatBytes(db.sizeBytes);
                                    return (
                                        <button
                                            key={db.name}
                                            className="db-item"
                                            onClick={() => handleSelect(db.name)}
                                            disabled={switching || isActive || !switchable}
                                            style={{
                                                ...styles.item,
                                                ...(isActive ? styles.itemActive : {}),
                                                cursor: !switchable ? 'default' : isActive ? 'default' : 'pointer',
                                            }}
                                        >
                                            <Database
                                                size={14}
                                                color={isActive ? THEME.primary : THEME.textMuted}
                                                style={{ flexShrink: 0 }}
                                            />
                                            <span
                                                style={{
                                                    ...styles.itemName,
                                                    color: isActive ? THEME.primary : THEME.textMain,
                                                }}
                                            >
                                                {db.name}
                                            </span>
                                            {size && <span style={styles.itemSize}>{size}</span>}
                                            {isActive && (
                                                <Check size={14} color={THEME.primary} style={{ flexShrink: 0 }} />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

const styles: Record<string, React.CSSProperties> = {
    wrapper: { position: 'relative', display: 'inline-block' },
    button: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${THEME.glassBorder}`,
        background: THEME.glass,
        cursor: 'pointer',
        fontFamily: THEME.fontBody,
        fontSize: '13px',
        fontWeight: 500,
        color: THEME.textMain,
        minWidth: '150px',
        maxWidth: '200px',
    },
    iconWrapper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        background: 'rgba(99, 102, 241, 0.08)',
        flexShrink: 0,
    },
    label: {
        flex: 1,
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '8px',
        width: '260px',
        maxHeight: '360px',
        borderRadius: '10px',
        background: THEME.surface,
        border: `1px solid ${THEME.glassBorder}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1000,
    },
    searchRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderBottom: `1px solid ${THEME.glassBorder}`,
        background: THEME.surfaceHover,
    },
    searchInput: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        color: THEME.textMain,
        fontSize: '12px',
        fontFamily: THEME.fontBody,
        outline: 'none',
        padding: 0,
    },
    refreshBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: '2px',
        flexShrink: 0,
    },
    notice: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '10px 12px',
        fontSize: '11px',
        lineHeight: 1.4,
        color: THEME.textMuted,
        borderBottom: `1px solid ${THEME.glassBorder}`,
        background: 'rgba(234, 179, 8, 0.06)',
    },
    list: { overflowY: 'auto' },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        color: THEME.textMain,
        fontSize: '12px',
        fontFamily: THEME.fontBody,
        textAlign: 'left',
    },
    itemActive: { background: 'rgba(99, 102, 241, 0.08)' },
    itemName: {
        flex: 1,
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    itemSize: {
        fontSize: '11px',
        color: THEME.textMuted,
        fontFamily: THEME.fontMono,
        flexShrink: 0,
    },
    empty: {
        padding: '18px 12px',
        textAlign: 'center',
        fontSize: '12px',
        color: THEME.textMuted,
    },
};

export default DatabaseSwitcher;
