import React, { useState, useEffect, useRef, useContext } from 'react';
import { CheckCircle, ChevronDown, Database } from 'lucide-react';
import { useConnection } from '../../context/ConnectionContext';
import { NavigationContext } from '../../context/NavigationContext';
import { DS } from '../../config/designTokens';

export const ConnectionSelector = () => {
    const { connections, activeConnectionId, activeConnection, switchConnection, loading } = useConnection();
    const { goToTab } = useContext(NavigationContext) || {};
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSwitch = async (id) => {
        if (id === activeConnectionId) {
            setOpen(false);
            return;
        }
        setSwitching(true);
        try {
            await switchConnection(id);
            // Auto-navigate to appropriate overview tab based on database type
            const targetConnection = connections.find((c) => c.id === id);
            if (targetConnection && goToTab) {
                const dbType = targetConnection.dbType?.toLowerCase();
                let targetTab = 'overview'; // Default to PostgreSQL overview

                if (dbType === 'mysql' || dbType === 'mariadb') {
                    targetTab = 'mysql-overview';
                } else if (dbType === 'mongodb') {
                    targetTab = 'mongo-overview';
                }

                // Defer navigation to allow state to settle
                setTimeout(() => {
                    goToTab(targetTab);
                }, 100);
            }
        } catch (err) {
            console.error('Switch failed:', err);
        } finally {
            setSwitching(false);
            setOpen(false);
        }
    };

    if (loading || connections.length === 0) return null;

    const displayName = activeConnection?.name || 'Select DB';
    const connString = activeConnection
        ? `${activeConnection.host}:${activeConnection.port}/${activeConnection.database}`
        : '';
    const statusColor =
        activeConnection?.status === 'success'
            ? DS.emerald
            : activeConnection?.status === 'failed'
              ? DS.rose
              : DS.amber;
    const statusLabel =
        activeConnection?.status === 'success'
            ? 'connected'
            : activeConnection?.status === 'failed'
              ? 'failed'
              : 'untested';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* ── Trigger button — shows name + connection string ── */}
            <button
                onClick={() => setOpen((p) => !p)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px 5px 9px',
                    background: open ? DS.surfaceHover : DS.surface,
                    border: `1px solid ${open ? DS.borderAccent : DS.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    maxWidth: 280,
                }}
                title={`Active: ${displayName}\n${connString}\nStatus: ${statusLabel}`}
            >
                {/* Status dot / spinner */}
                {switching ? (
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            border: `1.5px solid ${DS.border}`,
                            borderTopColor: DS.cyan,
                            animation: 'rotate 0.7s linear infinite',
                            flexShrink: 0,
                        }}
                    />
                ) : (
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: statusColor,
                            flexShrink: 0,
                            boxShadow: `0 0 5px ${statusColor}88`,
                        }}
                    />
                )}
                <Database size={12} style={{ color: DS.cyan, flexShrink: 0 }} />
                {/* Two-line label: name on top, connection string below */}
                <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: DS.textPrimary,
                                fontFamily: DS.fontMono,
                                maxWidth: 140,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.2,
                            }}
                        >
                            {displayName}
                        </span>
                        {/* Database type badge */}
                        {activeConnection && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: DS.cyan,
                                    background: `${DS.cyan}15`,
                                    border: `1px solid ${DS.cyan}40`,
                                    borderRadius: 3,
                                    padding: '2px 6px',
                                    flexShrink: 0,
                                    letterSpacing: '0.02em',
                                }}
                                title={`Database type: ${activeConnection.dbType || 'unknown'}`}
                            >
                                {activeConnection.dbType === 'postgresql'
                                    ? 'PG'
                                    : activeConnection.dbType === 'mysql'
                                      ? 'MySQL'
                                      : activeConnection.dbType === 'mariadb'
                                        ? 'Maria'
                                        : activeConnection.dbType === 'mongodb'
                                          ? 'Mongo'
                                          : 'DB'}
                            </span>
                        )}
                    </div>
                    {connString && (
                        <span
                            style={{
                                fontSize: 10,
                                color: DS.textMuted,
                                fontFamily: DS.fontMono,
                                maxWidth: 160,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                lineHeight: 1.3,
                                letterSpacing: '0.01em',
                            }}
                        >
                            {connString}
                        </span>
                    )}
                </div>
                <ChevronDown
                    size={12}
                    style={{
                        color: DS.textMuted,
                        flexShrink: 0,
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s ease',
                    }}
                />
            </button>

            {/* ── Dropdown ── */}
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        background: DS.surface,
                        border: `1px solid ${DS.border}`,
                        borderRadius: 10,
                        boxShadow: DS.shadowDeep,
                        minWidth: 300,
                        zIndex: 300,
                        overflow: 'hidden',
                        animation: 'slideDown 0.15s ease-out both',
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '10px 14px 8px', borderBottom: `1px solid ${DS.border}` }}>
                        <div
                            style={{
                                fontSize: 10,
                                color: DS.textMuted,
                                fontFamily: DS.fontMono,
                                letterSpacing: '0.02em',
                                marginBottom: 4,
                            }}
                        >
                            DATABASE CONNECTIONS
                        </div>
                        {/* Active connection string prominently shown */}
                        {activeConnection && (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '5px 8px',
                                    background: `${DS.cyan}10`,
                                    border: `1px solid ${DS.cyan}30`,
                                    borderRadius: 6,
                                }}
                            >
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: statusColor,
                                        flexShrink: 0,
                                        boxShadow: `0 0 4px ${statusColor}`,
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: DS.cyan,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {activeConnection.username}@{activeConnection.host}:{activeConnection.port}/
                                    {activeConnection.database}
                                </span>
                                {activeConnection.ssl && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: DS.emerald,
                                            background: `${DS.emerald}18`,
                                            padding: '1px 5px',
                                            borderRadius: 14,
                                            fontFamily: DS.fontMono,
                                            flexShrink: 0,
                                        }}
                                    >
                                        SSL
                                    </span>
                                )}
                                {activeConnection.sshEnabled && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: DS.violet,
                                            background: `${DS.violet}18`,
                                            padding: '1px 5px',
                                            borderRadius: 14,
                                            fontFamily: DS.fontMono,
                                            flexShrink: 0,
                                        }}
                                    >
                                        SSH
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Connection list */}
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {connections.map((c) => {
                            const isActive = c.id === activeConnectionId;
                            const cs =
                                activeConnection?.status === 'success'
                                    ? DS.emerald
                                    : c.status === 'failed'
                                      ? DS.rose
                                      : DS.amber;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => handleSwitch(c.id)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '10px 14px',
                                        background: isActive ? `${DS.cyan}12` : 'transparent',
                                        border: 'none',
                                        borderBottom: `1px solid ${DS.border}`,
                                        cursor: 'pointer',
                                        transition: 'background 0.12s',
                                    }}
                                    className="nav-item"
                                >
                                    <span
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            background:
                                                c.status === 'success'
                                                    ? DS.emerald
                                                    : c.status === 'failed'
                                                      ? DS.rose
                                                      : DS.amber,
                                            boxShadow: isActive ? `0 0 5px ${cs}` : 'none',
                                        }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                fontSize: 13,
                                                color: isActive ? DS.cyan : DS.textPrimary,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {c.name}
                                            {isActive && (
                                                <span
                                                    style={{
                                                        marginLeft: 6,
                                                        fontSize: 10,
                                                        color: DS.emerald,
                                                        fontWeight: 400,
                                                    }}
                                                >
                                                    ● active
                                                </span>
                                            )}
                                        </div>
                                        {/* Full connection string on second line */}
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: DS.textMuted,
                                                fontFamily: DS.fontMono,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                marginTop: 2,
                                            }}
                                        >
                                            {c.username}@{c.host}:{c.port}/{c.database}
                                            {c.ssl ? ' 🔒' : ''}
                                            {c.sshEnabled ? ' 🔑' : ''}
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <CheckCircle size={14} style={{ color: DS.cyan, flexShrink: 0 }} />
                                    ) : (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                color: DS.textMuted,
                                                fontFamily: DS.fontMono,
                                                flexShrink: 0,
                                            }}
                                        >
                                            switch
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div
                        style={{
                            padding: '8px 14px',
                            borderTop: `1px solid ${DS.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ fontSize: 11, color: DS.textMuted, fontFamily: DS.fontMono }}>
                            {connections.length} connection{connections.length !== 1 ? 's' : ''} configured
                        </span>
                        <span
                            onClick={() => {
                                goToTab?.('connections');
                                setOpen(false);
                            }}
                            style={{
                                fontSize: 11,
                                color: DS.cyan,
                                fontFamily: DS.fontMono,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted',
                            }}
                        >
                            Manage connections →
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};