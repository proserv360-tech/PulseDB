/**
 * ConnectionSwitcher.jsx
 * Dropdown widget for the top navigation bar showing the active connection with quick-switch.
 *
 * Features:
 * - Shows active connection name + type icon + status dot (compact, ~200px wide)
 * - Dropdown on click with all connections grouped by DB type
 * - Each item: name, host:port, status indicator, latency badge
 * - Click to switch (calls switchConnection from ConnectionContext)
 * - Keyboard shortcut hint: "Ctrl+K"
 * - Search/filter connections within dropdown
 * - Loading state during switch
 * - Smooth dropdown animation (max-height transition)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { THEME, useAdaptiveTheme } from '../../utils/theme';
import { useConnection } from '../../context/ConnectionContext';
import { useNavigation } from '../../context/NavigationContext';

import {
    Database, ChevronDown, Search, Check, Loader2,
    Server, AlertCircle, CheckCircle, AlertTriangle, Settings, Plus
} from 'lucide-react';

const ConnectionSwitcher = () => {
    useAdaptiveTheme();

    const { connections, activeConnectionId, switchConnection, loading } = useConnection();
    const { goToTab } = useNavigation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSwitching, setIsSwitching] = useState(false);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    // Get active connection info
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    // Filter connections based on search term
    const filteredConnections = connections.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.database.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by DB type — dynamic so Phase-5 engines (SQL Server, Oracle,
    // Redis, Elasticsearch, Snowflake, BigQuery, Redshift, Cassandra,
    // DynamoDB) each get their own group instead of being dumped into "Other".
    // Normalise dbType to a canonical key so variants like `postgres` ≡
    // `postgresql` and `mariadb` ≡ `mysql` collapse to the same bucket.
    const canonicalType = (raw) => {
        const t = (raw || 'postgresql').toLowerCase();
        if (t.includes('postgres'))                     return 'postgresql';
        if (t.includes('mysql') || t.includes('maria')) return 'mysql';
        if (t.includes('mongo'))                        return 'mongodb';
        if (t.includes('sqlserver') || t === 'mssql')   return 'mssql';
        if (t.includes('oracle'))                       return 'oracle';
        if (t.includes('redis'))                        return 'redis';
        if (t.includes('elastic') || t.includes('opensearch')) return 'elasticsearch';
        if (t.includes('snowflake'))                    return 'snowflake';
        if (t.includes('bigquery'))                     return 'bigquery';
        if (t.includes('redshift'))                     return 'redshift';
        if (t.includes('cassandra') || t.includes('scylla')) return 'cassandra';
        if (t.includes('dynamo'))                       return 'dynamodb';
        return 'other';
    };

    const TYPE_LABEL = {
        postgresql:    'PostgreSQL',
        mysql:         'MySQL',
        mongodb:       'MongoDB',
        mssql:         'SQL Server',
        oracle:        'Oracle',
        redis:         'Redis',
        elasticsearch: 'Elasticsearch',
        snowflake:     'Snowflake',
        bigquery:      'BigQuery',
        redshift:      'Redshift',
        cassandra:     'Cassandra',
        dynamodb:      'DynamoDB',
        other:         'Other',
    };

    // Fixed display order — pinned engines first (existing), Phase-5 engines
    // next, "other" last.
    const GROUP_ORDER = [
        'postgresql', 'mysql', 'mongodb',
        'mssql', 'oracle', 'redis', 'elasticsearch',
        'snowflake', 'bigquery', 'redshift', 'cassandra', 'dynamodb',
        'other',
    ];

    const groupedByType = GROUP_ORDER.reduce((acc, key) => {
        acc[key] = filteredConnections.filter(c => canonicalType(c.dbType) === key);
        return acc;
    }, {});

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Focus search input when dropdown opens
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Handle keyboard shortcut Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSwitch = useCallback(async (connId) => {
        setIsSwitching(true);
        try {
            await switchConnection(connId);
            setIsOpen(false);
            setSearchTerm('');
        } catch (err) {
            console.error('[ConnectionSwitcher] Failed to switch:', err);
        } finally {
            setIsSwitching(false);
        }
    }, [switchConnection]);

    const getDBTypeIcon = (dbType) => {
        switch ((dbType || 'postgresql').toLowerCase()) {
            case 'mysql': return <Database size={14} color={THEME.primary} />;
            case 'mongodb': return <Server size={14} color={THEME.primary} />;
            case 'postgresql':
            default: return <Database size={14} color={THEME.primary} />;
        }
    };

    const getDBTypeLabel = (dbType) => {
        const type = (dbType || 'postgresql').toLowerCase();
        if (type.includes('mysql')) return 'MySQL';
        if (type.includes('mongo')) return 'MongoDB';
        return 'PostgreSQL';
    };

    if (!activeConnection) {
        // During initial loading, show a subtle loading state instead of "No connection"
        // to prevent the flash of "No connection" on every page refresh
        const isLoading = loading;
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                    ...styles.emptyState,
                    cursor: 'default',
                }}>
                    <Database size={14} color={isLoading ? THEME.primary : THEME.textMuted} />
                    <span>{isLoading ? 'Connecting...' : 'No connection'}</span>
                </div>
                {!isLoading && (
                    <button
                        onClick={() => {
                            goToTab('connections');
                            setTimeout(() => window.dispatchEvent(new CustomEvent('pulsedb:open-new-connection')), 100);
                        }}
                        title="Add new connection"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: 8,
                            border: `1px solid ${THEME.primary}44`,
                            background: `${THEME.primary}15`,
                            color: THEME.primary,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${THEME.primary}30`; e.currentTarget.style.borderColor = `${THEME.primary}66`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${THEME.primary}15`; e.currentTarget.style.borderColor = `${THEME.primary}44`; }}
                    >
                        <Plus size={16} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <>
            <style>{`
                @keyframes dropdownSlide {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .cs-dropdown {
                    animation: dropdownSlide 0.2s ease-out;
                }
                .cs-item {
                    transition: all 0.15s ease-in-out;
                }
                .cs-item:hover {
                    background: ${THEME.surfaceHover};
                }
            `}</style>

            <div style={styles.wrapper} ref={dropdownRef}>
                {/* Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isSwitching || connections.length <= 1}
                    className="transition-all duration-200 ease-in-out hover:bg-white/5 active:ring-1 active:ring-white/10"
                    style={{
                        ...styles.button,
                        opacity: isSwitching ? 0.6 : 1,
                    }}
                    title={`Active: ${activeConnection.name} (Ctrl+K to switch)`}
                >
                    <div style={styles.buttonContent}>
                        <div style={styles.iconWrapper}>
                            {getDBTypeIcon(activeConnection.dbType)}
                        </div>
                        <span style={styles.buttonLabel}>{activeConnection.name}</span>
                        {isSwitching ? (
                            <Loader2 size={14} style={{ animation: 'rotation 1s linear infinite' }} />
                        ) : (
                            <ChevronDown
                                size={14}
                                style={{
                                    transition: 'transform 0.2s ease',
                                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                }}
                            />
                        )}
                    </div>
                </button>

                {/* Dropdown Menu */}
                {isOpen && connections.length > 1 && (
                    <div style={styles.dropdown} className="cs-dropdown animate-fadeIn">
                        {/* Search Input */}
                        <div style={styles.searchContainer}>
                            <Search size={14} color={THEME.textMuted} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search connections..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={styles.searchInput}
                            />
                        </div>

                        {/* Grouped Connections */}
                        <div style={styles.itemsContainer}>
                            {Object.entries(groupedByType).map(([type, group]) => {
                                if (group.length === 0) return null;

                                return (
                                    <div key={type}>
                                        {/* Group Header */}
                                        <div style={styles.groupHeader}>
                                            {TYPE_LABEL[type] || (type.charAt(0).toUpperCase() + type.slice(1))}
                                        </div>

                                        {/* Group Items */}
                                        {group.map(conn => (
                                            <button
                                                key={conn.id}
                                                onClick={() => handleSwitch(conn.id)}
                                                disabled={isSwitching || conn.id === activeConnectionId}
                                                style={{
                                                    ...styles.item,
                                                    ...(conn.id === activeConnectionId
                                                        ? styles.itemActive
                                                        : {}),
                                                }}
                                                className="cs-item"
                                            >
                                                <div style={styles.itemLeft}>
                                                    <div style={styles.itemIconWrapper}>
                                                        {getDBTypeIcon(conn.dbType)}
                                                    </div>
                                                    <div style={styles.itemTextContent}>
                                                        <div style={styles.itemName}>
                                                            {conn.name}
                                                        </div>
                                                        <div style={styles.itemHost}>
                                                            {conn.host}:{conn.port}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={styles.itemRight}>
                                                    {conn.id === activeConnectionId ? (
                                                        <Check size={14} color={THEME.primary} />
                                                    ) : null}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}

                            {/* No results */}
                            {filteredConnections.length === 0 && (
                                <div style={styles.noResults}>
                                    No connections found
                                </div>
                            )}
                        </div>

                        {/* Footer with Manage + shortcut hint */}
                        <div style={styles.footer}>
                            <button
                                onClick={() => { setIsOpen(false); goToTab('connections'); }}
                                style={{
                                    background: 'none', border: 'none', color: THEME.primary,
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '2px 0', fontFamily: 'inherit',
                                    transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                <Settings size={12} />
                                Manage Connections
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <kbd style={styles.shortcutKey}>Ctrl+K</kbd>
                                <span>to toggle</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Rotation animation keyframe */}
            <style>{`
                @keyframes rotation {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
};

/**
 * Inline styles
 */
const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        position: 'relative',
        display: 'inline-block',
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${THEME.glassBorder}`,
        background: THEME.glass,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: THEME.fontBody,
        fontSize: '13px',
        fontWeight: '500',
        color: THEME.textMain,
        minWidth: '180px',
        maxWidth: '220px',
    },
    buttonContent: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
    },
    iconWrapper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        background: `rgba(99, 102, 241, 0.08)`,
        flexShrink: 0,
    },
    buttonLabel: {
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
        width: '280px',
        maxHeight: '420px',
        borderRadius: '10px',
        background: THEME.surface,
        border: `1px solid ${THEME.glassBorder}`,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 1000,
    },
    searchContainer: {
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
    itemsContainer: {
        flex: 1,
        overflowY: 'auto',
    },
    groupHeader: {
        padding: '10px 12px 6px 12px',
        fontSize: '11px',
        fontWeight: '600',
        color: THEME.textMuted,
        letterSpacing: '0.5px',
        borderTop: `1px solid ${THEME.glassBorder}`,
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        background: 'transparent',
        color: THEME.textMain,
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: THEME.fontBody,
        textAlign: 'left',
    },
    itemActive: {
        background: `rgba(99, 102, 241, 0.08)`,
        border: `1px solid ${THEME.primary}`,
    },
    itemLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flex: 1,
    },
    itemIconWrapper: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: `rgba(99, 102, 241, 0.06)`,
        flexShrink: 0,
    },
    itemTextContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflow: 'hidden',
        minWidth: 0,
    },
    itemName: {
        fontSize: '12px',
        fontWeight: '600',
        color: THEME.textMain,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    itemHost: {
        fontSize: '11px',
        color: THEME.textMuted,
        fontFamily: THEME.fontMono,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    itemRight: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '20px',
        flexShrink: 0,
    },
    noResults: {
        padding: '20px 12px',
        textAlign: 'center',
        fontSize: '12px',
        color: THEME.textMuted,
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        padding: '8px 12px',
        borderTop: `1px solid ${THEME.glassBorder}`,
        fontSize: '11px',
        color: THEME.textMuted,
        background: THEME.surfaceHover,
    },
    shortcutKey: {
        padding: '2px 6px',
        borderRadius: '4px',
        border: `1px solid ${THEME.glassBorder}`,
        background: THEME.glass,
        fontFamily: THEME.fontMono,
        fontSize: '10px',
        color: THEME.textMain,
    },
    emptyState: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: `1px solid ${THEME.glassBorder}`,
        background: THEME.glass,
        fontSize: '13px',
        color: THEME.textMuted,
        opacity: 0.6,
    },
};

export default ConnectionSwitcher;
