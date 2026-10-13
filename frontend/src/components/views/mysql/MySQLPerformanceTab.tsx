import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { TrendingUp, AlertCircle, Lock, Clock, Activity, Zap } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────── */
/* THEME & CONSTANTS */
/* ─────────────────────────────────────────────────────────────────────────── */
const DARK_THEME = {
    bg: THEME.bg,
    card: THEME.surface,
    border: THEME.grid,
    text: THEME.textMain,
    textMuted: THEME.textMuted,
    accent: THEME.primaryLight,
    success: THEME.success,
    warning: THEME.warning,
    danger: THEME.danger,
};

const Styles = () => (
    <style>{`
        @keyframes mysql-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mysql-pulse { 0%{opacity:1} 50%{opacity:0.6} 100%{opacity:1} }

        .mysql-card {
            background: ${DARK_THEME.card};
            border: 1px solid ${DARK_THEME.border};
            border-top: 3px solid #3E6D8E;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
            animation: mysql-fade 0.3s ease;
        }

        .mysql-card:hover {
            box-shadow: 0 12px 28px rgba(62,109,142,0.16);
            transform: translateY(-4px);
        }

        .mysql-card-head {
            background: rgba(62,109,142,0.06);
            padding: 14px 20px;
            border-bottom: 1px solid ${DARK_THEME.border};
            display: flex;
            align-items: center;
            gap: 22px;
            font-weight: 700;
        }

        .mysql-card-body {
            padding: 22px 26px;
        }

        .mysql-metric-box {
            background: ${DARK_THEME.card};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 20px;
            padding: 20px;
            text-align: center;
        }

        .mysql-metric-label {
            font-size: 11px;
            color: ${DARK_THEME.textMuted};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }

        .mysql-metric-value {
            font-size: 24px;
            font-weight: 700;
            color: ${DARK_THEME.accent};
        }

        .mysql-section {
            margin-bottom: 24px;
        }

        .mysql-section-title {
            font-size: 13px;
            font-weight: 700;
            color: ${DARK_THEME.text};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .mysql-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .mysql-table thead {
            background: ${DARK_THEME.bg};
            border-bottom: 2px solid ${DARK_THEME.border};
        }

        .mysql-table th {
            color: ${DARK_THEME.textMuted};
            font-weight: 600;
            padding: 12px;
            text-align: left;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }

        .mysql-table td {
            color: ${DARK_THEME.text};
            padding: 12px;
            border-bottom: 1px solid ${DARK_THEME.border};
        }

        .mysql-table tbody tr:hover {
            background: ${DARK_THEME.bg}80;
        }

        .mysql-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            padding: 40px 20px;
            color: ${DARK_THEME.textMuted};
            font-size: 14px;
        }

        .mysql-spinner {
            animation: mysql-pulse 1.5s ease-in-out infinite;
        }

        .mysql-error {
            background: ${DARK_THEME.danger}15;
            border: 1px solid ${DARK_THEME.danger};
            border-radius: 20px;
            padding: 16px;
            color: ${DARK_THEME.danger};
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 22px;
        }

        .mysql-empty {
            background: ${DARK_THEME.card};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 20px;
            padding: 32px 20px;
            text-align: center;
            color: ${DARK_THEME.textMuted};
        }

        .mysql-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }

        .mysql-progress-bar {
            height: 8px;
            background: ${DARK_THEME.border};
            border-radius: 20px;
            overflow: hidden;
            margin-top: 8px;
        }

        .mysql-progress-fill {
            height: 100%;
            background: ${DARK_THEME.accent};
        }
    `}</style>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPER FUNCTIONS */
/* ─────────────────────────────────────────────────────────────────────────── */
const fmt = (n) => {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const getHealthColor = (percentage) => {
    if (percentage >= 80) return DARK_THEME.success;
    if (percentage >= 60) return DARK_THEME.warning;
    return DARK_THEME.danger;
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MYSQL PERFORMANCE TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MySQLPerformanceTab() {
    const [performance, setPerformance] = useState(null);
    const [activeQueries, setActiveQueries] = useState([]);
    const [locks, setLocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const [perfData, queries, lockData] = await Promise.all([
                fetchData('/api/mysql/performance').catch(() => null),
                fetchData('/api/mysql/active-queries').catch(() => null),
                fetchData('/api/mysql/locks').catch(() => null),
            ]);

            setPerformance(
                perfData || {
                    slowQueries: 0,
                    threadsRunning: 0,
                    threadsConnected: 0,
                    innodbBufferPoolReads: 0,
                    innodbBufferPoolHitRatio: 0,
                    queriesSlow: 0,
                    diskReads: 0,
                    diskWrites: 0,
                },
            );

            setActiveQueries(queries || []);

            setLocks(lockData || []);
        } catch (err) {
            setError(err.message || 'Failed to load MySQL performance data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        pollIntervalRef.current = setInterval(loadData, 30000);
        return () => clearInterval(pollIntervalRef.current);
    }, [loadData]);

    if (loading) {
        return (
            <>
                <Styles />
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="mysql-loading">
                        <TrendingUp className="mysql-spinner" size={20} />
                        Loading performance metrics...
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Styles />
            <div style={{ padding:'0 0 20px 0' }}>
                {/* Error Banner */}
                {error && (
                    <div className="mysql-error">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Performance Metrics */}
                <div className="mysql-section">
                    <h3 className="mysql-section-title">
                        <TrendingUp size={16} /> Performance Metrics
                    </h3>
                    <div className="mysql-grid">
                        <div className="mysql-metric-box">
                            <div className="mysql-metric-label">Slow Queries</div>
                            <div className="mysql-metric-value">{fmt(performance?.slowQueries)}</div>
                        </div>
                        <div className="mysql-metric-box">
                            <div className="mysql-metric-label">Threads Running</div>
                            <div className="mysql-metric-value">{fmt(performance?.threadsRunning)}</div>
                        </div>
                        <div className="mysql-metric-box">
                            <div className="mysql-metric-label">Threads Connected</div>
                            <div className="mysql-metric-value">{fmt(performance?.threadsConnected)}</div>
                        </div>
                        <div className="mysql-metric-box">
                            <div className="mysql-metric-label">InnoDB Buffer Pool Reads</div>
                            <div className="mysql-metric-value">{fmt(performance?.innodbBufferPoolReads)}</div>
                        </div>
                    </div>
                </div>

                {/* Buffer Pool Hit Ratio */}
                <div className="mysql-section">
                    <h3 className="mysql-section-title">
                        <Zap size={16} /> InnoDB Buffer Pool
                    </h3>
                    <div className="mysql-card">
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 12,
                            }}
                        >
                            <span style={{ fontSize: 13, fontWeight: 600, color: DARK_THEME.text }}>Hit Ratio</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: DARK_THEME.accent }}>
                                {fmt(performance?.innodbBufferPoolHitRatio)}%
                            </span>
                        </div>
                        <div className="mysql-progress-bar">
                            <div
                                className="mysql-progress-fill"
                                style={{
                                    width: `${Math.min(performance?.innodbBufferPoolHitRatio || 0, 100)}%`,
                                    background: getHealthColor(performance?.innodbBufferPoolHitRatio || 0),
                                }}
                            />
                        </div>
                        <div style={{ fontSize: 12, color: DARK_THEME.textMuted, marginTop: 12 }}>
                            {performance?.innodbBufferPoolHitRatio >= 99 ? (
                                <span style={{ color: DARK_THEME.success }}>Excellent cache efficiency</span>
                            ) : performance?.innodbBufferPoolHitRatio >= 95 ? (
                                <span style={{ color: DARK_THEME.warning }}>Good cache efficiency</span>
                            ) : (
                                <span style={{ color: DARK_THEME.danger }}>Consider increasing buffer pool size</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Disk I/O */}
                <div className="mysql-section">
                    <h3 className="mysql-section-title">
                        <Activity size={16} /> Disk I/O
                    </h3>
                    <div className="mysql-grid">
                        <div className="mysql-metric-box">
                            <div className="mysql-metric-label">Disk Reads</div>
                            <div className="mysql-metric-value">{fmt(performance?.diskReads)}</div>
                        </div>
                        <div className="mysql-metric-box">
                            <div className="mysql-metric-label">Disk Writes</div>
                            <div className="mysql-metric-value">{fmt(performance?.diskWrites)}</div>
                        </div>
                    </div>
                </div>

                {/* Active Queries */}
                <div className="mysql-section">
                    <h3 className="mysql-section-title">
                        <Clock size={16} /> Active Queries
                    </h3>
                    {activeQueries && activeQueries.length > 0 ? (
                        <div className="mysql-card" style={{ padding: 0, overflow: 'auto' }}>
                            <table className="mysql-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>User</th>
                                        <th>Database</th>
                                        <th>Command</th>
                                        <th>Time (s)</th>
                                        <th>State</th>
                                        <th>Query</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeQueries.map((query, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{query.id}</td>
                                            <td>{query.user}</td>
                                            <td>{query.db || '—'}</td>
                                            <td>
                                                <span
                                                    style={{
                                                        background: DARK_THEME.bg,
                                                        color: DARK_THEME.accent,
                                                        padding: '2px 6px',
                                                        borderRadius: 16,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {query.command}
                                                </span>
                                            </td>
                                            <td>{query.time}</td>
                                            <td style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                {query.state || '—'}
                                            </td>
                                            <td
                                                style={{
                                                    fontSize: 12,
                                                    color: DARK_THEME.textMuted,
                                                    maxWidth: 300,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {query.info || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="mysql-empty">No active queries. System is idle.</div>
                    )}
                </div>

                {/* Lock Information */}
                <div className="mysql-section">
                    <h3 className="mysql-section-title">
                        <Lock size={16} /> Lock Information
                    </h3>
                    {locks && locks.length > 0 ? (
                        <div className="mysql-card" style={{ padding: 0, overflow: 'auto' }}>
                            <table className="mysql-table">
                                <thead>
                                    <tr>
                                        <th>Schema</th>
                                        <th>Object</th>
                                        <th>Lock Type</th>
                                        <th>Status</th>
                                        <th>Thread ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {locks.map((lock, idx) => (
                                        <tr key={idx}>
                                            <td>{lock.objectSchema}</td>
                                            <td style={{ fontWeight: 600 }}>{lock.objectName}</td>
                                            <td>
                                                <span
                                                    style={{
                                                        background: DARK_THEME.bg,
                                                        color: DARK_THEME.accent,
                                                        padding: '2px 6px',
                                                        borderRadius: 16,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {lock.lockType}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    style={{
                                                        color:
                                                            lock.lockStatus === 'GRANTED'
                                                                ? DARK_THEME.success
                                                                : DARK_THEME.warning,
                                                    }}
                                                >
                                                    {lock.lockStatus}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                {lock.threadId}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="mysql-empty">No active locks. No contention detected.</div>
                    )}
                </div>
            </div>
        </>
    );
}