import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import { Server, AlertCircle, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

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
            padding: 16px;
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

        .mysql-status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .mysql-status-healthy {
            background: ${DARK_THEME.success};
        }

        .mysql-status-warning {
            background: ${DARK_THEME.warning};
        }

        .mysql-status-critical {
            background: ${DARK_THEME.danger};
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

        .mysql-status-box {
            background: ${DARK_THEME.bg};
            border: 1px solid ${DARK_THEME.border};
            border-radius: 22px;
            padding: 16px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 22px;
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

/* ═══════════════════════════════════════════════════════════════════════════ */
/* MYSQL REPLICATION TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function MySQLReplicationTab() {
    const [replication, setReplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            setError(null);
            const repData = await fetchData('/api/mysql/replication').catch(() => null);

            setReplication(repData || null);
        } catch (err) {
            setError(err.message || 'Failed to load MySQL replication data');
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
                        <Server className="mysql-spinner" size={20} />
                        Loading replication status...
                    </div>
                </div>
            </>
        );
    }

    const isReplicationConfigured =
        replication &&
        (replication.slaveStatus ||
            replication.ioThreadRunning !== undefined ||
            replication.sqlThreadRunning !== undefined);

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

                {!isReplicationConfigured ? (
                    <div className="mysql-empty">
                        <Server size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                        <h3 style={{ color: DARK_THEME.text, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
                            Replication Not Configured
                        </h3>
                        <p>This MySQL instance is not configured as a replication slave.</p>
                        <p style={{ fontSize: 12, marginTop: 12 }}>
                            To enable replication monitoring, configure this server as a slave of a master MySQL
                            instance.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Replication Status Overview */}
                        <div className="mysql-section">
                            <h3 className="mysql-section-title">
                                <Server size={16} /> Replication Status
                            </h3>
                            <div className="mysql-card">
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                        gap: 22,
                                    }}
                                >
                                    {/* IO Thread */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: DARK_THEME.textMuted,
                                                marginBottom: 12,
                                                
                                            }}
                                        >
                                            IO Thread
                                        </div>
                                        <div className="mysql-status-box">
                                            <div
                                                className={`mysql-status-indicator mysql-status-${replication?.ioThreadRunning ? 'healthy' : 'critical'}`}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, color: DARK_THEME.text }}>
                                                    {replication?.ioThreadRunning ? 'Running' : 'Stopped'}
                                                </div>
                                                {replication?.ioThreadLastError && (
                                                    <div
                                                        style={{ fontSize: 11, color: DARK_THEME.danger, marginTop: 4 }}
                                                    >
                                                        {replication.ioThreadLastError}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SQL Thread */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: DARK_THEME.textMuted,
                                                marginBottom: 12,
                                                
                                            }}
                                        >
                                            SQL Thread
                                        </div>
                                        <div className="mysql-status-box">
                                            <div
                                                className={`mysql-status-indicator mysql-status-${replication?.sqlThreadRunning ? 'healthy' : 'critical'}`}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, color: DARK_THEME.text }}>
                                                    {replication?.sqlThreadRunning ? 'Running' : 'Stopped'}
                                                </div>
                                                {replication?.sqlThreadLastError && (
                                                    <div
                                                        style={{ fontSize: 11, color: DARK_THEME.danger, marginTop: 4 }}
                                                    >
                                                        {replication.sqlThreadLastError}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Seconds Behind Master */}
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: DARK_THEME.textMuted,
                                                marginBottom: 12,
                                                
                                            }}
                                        >
                                            Seconds Behind Master
                                        </div>
                                        <div className="mysql-status-box">
                                            <div
                                                className={`mysql-status-indicator mysql-status-${
                                                    replication?.secondsBehindMaster === 0
                                                        ? 'healthy'
                                                        : replication?.secondsBehindMaster < 10
                                                          ? 'warning'
                                                          : 'critical'
                                                }`}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, color: DARK_THEME.text, fontSize: 16 }}>
                                                    {replication?.secondsBehindMaster !== null &&
                                                    replication?.secondsBehindMaster !== undefined
                                                        ? fmt(replication.secondsBehindMaster)
                                                        : '—'}
                                                    s
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Binary Log Information */}
                        <div className="mysql-section">
                            <h3 className="mysql-section-title">
                                <Clock size={16} /> Binary Log Information
                            </h3>
                            <div className="mysql-grid">
                                <div className="mysql-metric-box">
                                    <div className="mysql-metric-label">Master Log File</div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: DARK_THEME.text,
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {replication?.masterLogFile || '—'}
                                    </div>
                                </div>
                                <div className="mysql-metric-box">
                                    <div className="mysql-metric-label">Master Log Position</div>
                                    <div className="mysql-metric-value">{fmt(replication?.readMasterLogPos)}</div>
                                </div>
                                <div className="mysql-metric-box">
                                    <div className="mysql-metric-label">Relay Log File</div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: DARK_THEME.text,
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {replication?.relayLogFile || '—'}
                                    </div>
                                </div>
                                <div className="mysql-metric-box">
                                    <div className="mysql-metric-label">Relay Log Position</div>
                                    <div className="mysql-metric-value">{fmt(replication?.relayLogPos)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Relay Master Information */}
                        <div className="mysql-section">
                            <h3 className="mysql-section-title">
                                <Server size={16} /> Relay Master Log Info
                            </h3>
                            <div className="mysql-grid">
                                <div className="mysql-metric-box">
                                    <div className="mysql-metric-label">Relay Master Log File</div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: DARK_THEME.text,
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {replication?.relayMasterLogFile || '—'}
                                    </div>
                                </div>
                                <div className="mysql-metric-box">
                                    <div className="mysql-metric-label">Exec Master Log Position</div>
                                    <div className="mysql-metric-value">{fmt(replication?.execMasterLogPos)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Replication Details */}
                        {replication && (
                            <div className="mysql-section">
                                <h3 className="mysql-section-title">
                                    <CheckCircle size={16} /> Replication Details
                                </h3>
                                <div className="mysql-card" style={{ padding: 0, overflow: 'auto' }}>
                                    <table className="mysql-table">
                                        <tbody>
                                            <tr>
                                                <td style={{ fontWeight: 600, width: '30%' }}>Skip Errors</td>
                                                <td>{replication?.skipErrors || '—'}</td>
                                            </tr>
                                            {replication?.replDoBb !== undefined && (
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Do Database</td>
                                                    <td>{replication.replDoBb || 'All'}</td>
                                                </tr>
                                            )}
                                            {replication?.replIgnoreDb !== undefined && (
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Ignore Database</td>
                                                    <td>{replication.replIgnoreDb || 'None'}</td>
                                                </tr>
                                            )}
                                            {replication?.replDoTable !== undefined && (
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Do Table</td>
                                                    <td style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                        {replication.replDoTable || 'All tables'}
                                                    </td>
                                                </tr>
                                            )}
                                            {replication?.replIgnoreTable !== undefined && (
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Ignore Table</td>
                                                    <td style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                        {replication.replIgnoreTable || 'No tables'}
                                                    </td>
                                                </tr>
                                            )}
                                            {replication?.replWildDoTable !== undefined && (
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Do Wildcard Table</td>
                                                    <td style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                        {replication.replWildDoTable || 'None'}
                                                    </td>
                                                </tr>
                                            )}
                                            {replication?.replWildIgnoreTable !== undefined && (
                                                <tr>
                                                    <td style={{ fontWeight: 600 }}>Ignore Wildcard Table</td>
                                                    <td style={{ fontSize: 12, color: DARK_THEME.textMuted }}>
                                                        {replication.replWildIgnoreTable || 'None'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}