import React, { useState, useEffect, useCallback } from 'react';
import {
    FileSearch,
    RefreshCw,
    AlertTriangle,
    Clock,
    Database,
    Activity,
    Search,
    CheckCircle,
    TrendingUp,
    Zap,
    Shield,
} from 'lucide-react';
import { useGlobalRefresh } from '../../../utils/theme';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';

const Styles = () => (
    <style>{`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }
    .slide-up {
      animation: slideUp 0.4s ease-out;
    }
    .analytics-card {
      background: ${THEME.surface};
      border: 1px solid ${THEME.glassBorder};
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      backdrop-filter: blur(12px);
      transition: all 0.25s ease;
    }
    .analytics-card:hover {
      box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08);
      transform: translateY(-4px);
    }
    .analytics-card-ribbon {
      height: 50px;
      background: linear-gradient(135deg, var(--ribbon-color, ${THEME.primary}) 0%, var(--ribbon-end, ${THEME.primary}cc) 100%);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 18px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    .analytics-card-body {
      padding: 20px;
    }
  `}</style>
);

// Summary Card Component
const SummaryCard = ({ label, value, subtext, color = THEME.primary, isLoading }) => {
    if (isLoading) {
        return (
            <div className="analytics-card">
                <div
                    className="analytics-card-ribbon"
                    style={{ '--ribbon-color': color, '--ribbon-end': color + 'cc' }}
                >
                    <div
                        style={{
                            height: '16px',
                            width: '16px',
                            background: 'rgba(255,255,255,0.3)',
                            borderRadius: '4px',
                        }}
                    />
                    <span>{label}</span>
                </div>
                <div className="analytics-card-body">
                    <div
                        style={{
                            height: '32px',
                            background: THEME.textDim,
                            borderRadius: '6px',
                            animation: 'pulse 2s infinite',
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div
            className="analytics-card slide-up"
            style={{
                cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <div className="analytics-card-ribbon" style={{ '--ribbon-color': color, '--ribbon-end': color + 'cc' }}>
                <span>{label}</span>
            </div>
            <div className="analytics-card-body">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ fontSize: '28px', fontWeight: '600', color, fontFamily: THEME.fontDisplay }}>
                        {value}
                    </div>
                    {subtext && <div style={{ fontSize: '12px', color: THEME.textMuted }}>{subtext}</div>}
                </div>
            </div>
        </div>
    );
};

// Lock Waits Table
const LockWaitsTable = ({ lockWaits }) => {
    if (!lockWaits || lockWaits.length === 0) {
        return (
            <div
                style={{
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: '12px',
                    padding: '32px',
                    textAlign: 'center',
                    color: THEME.textMuted,
                }}
            >
                No active lock waits detected
            </div>
        );
    }

    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: '12px',
                overflow: 'hidden',
            }}
        >
            <div style={{ overflowX: 'auto' }}>
                <table
                    style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontFamily: THEME.fontMono,
                    }}
                >
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                            <th
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    color: THEME.textMuted,
                                    fontWeight: '500',
                                    fontSize: '12px',
                                }}
                            >
                                Blocked PID
                            </th>
                            <th
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    color: THEME.textMuted,
                                    fontWeight: '500',
                                    fontSize: '12px',
                                }}
                            >
                                Blocked User
                            </th>
                            <th
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    color: THEME.textMuted,
                                    fontWeight: '500',
                                    fontSize: '12px',
                                }}
                            >
                                Query
                            </th>
                            <th
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    color: THEME.textMuted,
                                    fontWeight: '500',
                                    fontSize: '12px',
                                }}
                            >
                                Blocking PID
                            </th>
                            <th
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    color: THEME.textMuted,
                                    fontWeight: '500',
                                    fontSize: '12px',
                                }}
                            >
                                Blocking User
                            </th>
                            <th
                                style={{
                                    padding: '20px 24px',
                                    textAlign: 'left',
                                    color: THEME.textMuted,
                                    fontWeight: '500',
                                    fontSize: '12px',
                                }}
                            >
                                Wait (s)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {lockWaits.map((wait, idx) => {
                            // FIX 1: Guard against null/undefined wait_sec before calling toFixed
                            const waitSec = parseFloat(wait.wait_sec) || 0;
                            const waitColor = waitSec > 30 ? THEME.danger : THEME.warning;
                            return (
                                <tr
                                    key={idx}
                                    style={{
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = THEME.surfaceHover;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <td style={{ padding: '20px 24px', color: THEME.textMain, fontSize: '13px' }}>
                                        {wait.blocked_pid}
                                    </td>
                                    <td style={{ padding: '20px 24px', color: THEME.textMain, fontSize: '13px' }}>
                                        {wait.blocked_user}
                                    </td>
                                    <td
                                        style={{
                                            padding: '20px 24px',
                                            color: THEME.textMuted,
                                            fontSize: '13px',
                                            maxWidth: '300px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {wait.blocked_query}
                                    </td>
                                    <td style={{ padding: '20px 24px', color: THEME.textMain, fontSize: '13px' }}>
                                        {wait.blocking_pid}
                                    </td>
                                    <td style={{ padding: '20px 24px', color: THEME.textMain, fontSize: '13px' }}>
                                        {wait.blocking_user}
                                    </td>
                                    <td
                                        style={{
                                            padding: '20px 24px',
                                            color: waitColor,
                                            fontSize: '13px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {waitSec.toFixed(1)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Wait Event Breakdown
const WaitEventBreakdown = ({ waitEvents }) => {
    if (!waitEvents || waitEvents.length === 0) {
        return null;
    }

    const colors = [THEME.danger, THEME.warning, THEME.primary, THEME.secondary, THEME.success, THEME.ai, THEME.info];

    // Guard: count may arrive as a string from the API; coerce to number to prevent
    // string concatenation in the reduce and NaN.toFixed() crashes downstream.
    const total = waitEvents.reduce((sum, e) => sum + (Number(e.count) || 0), 0);

    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: '12px',
                padding: '24px',
                marginTop: '16px',
            }}
        >
            <div style={{ marginBottom: '16px', color: THEME.textMain, fontWeight: '500' }}>Wait Event Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitEvents.map((event, idx) => {
                    const count = Number(event.count) || 0;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const color = colors[idx % colors.length];
                    return (
                        <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div style={{ color: THEME.textMain, fontSize: '13px' }}>
                                    {event.wait_event_type} - {event.wait_event}
                                </div>
                                <div style={{ color, fontSize: '13px', fontWeight: '500' }}>
                                    {count} ({percentage.toFixed(1)}%)
                                </div>
                            </div>
                            <div
                                style={{
                                    height: '8px',
                                    background: THEME.glassBorder,
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${percentage}%`,
                                        background: color,
                                        transition: 'width 0.3s ease',
                                        borderRadius: '4px',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Slow Queries Table
const SlowQueriesTable = ({ slowQueries, searchTerm, onSearchChange }) => {
    // FIX 2: Guard against undefined query_preview before calling toLowerCase
    const filtered = (slowQueries || []).filter((q) =>
        (q.query_preview || '').toLowerCase().includes(searchTerm.toLowerCase()),
    );

    const getMeanColor = (mean) => {
        if (mean < 100) return THEME.success;
        if (mean < 500) return THEME.warning;
        return THEME.danger;
    };

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '16px',
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: '8px',
                    padding: '20px 24px',
                }}
            >
                <Search size={16} style={{ color: THEME.textMuted, marginRight: '8px' }} />
                <input
                    type="text"
                    placeholder="Search queries..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: THEME.textMain,
                        fontSize: '13px',
                        outline: 'none',
                    }}
                />
            </div>

            {filtered.length === 0 ? (
                <div
                    style={{
                        background: THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: '12px',
                        padding: '32px',
                        textAlign: 'center',
                        color: THEME.textMuted,
                    }}
                >
                    No slow queries found
                </div>
            ) : (
                <div
                    style={{
                        background: THEME.surface,
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ overflowX: 'auto' }}>
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontFamily: THEME.fontMono,
                            }}
                        >
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}>
                                    <th
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'left',
                                            color: THEME.textMuted,
                                            fontWeight: '500',
                                            fontSize: '12px',
                                        }}
                                    >
                                        Query
                                    </th>
                                    <th
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'right',
                                            color: THEME.textMuted,
                                            fontWeight: '500',
                                            fontSize: '12px',
                                        }}
                                    >
                                        Calls
                                    </th>
                                    <th
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'right',
                                            color: THEME.textMuted,
                                            fontWeight: '500',
                                            fontSize: '12px',
                                        }}
                                    >
                                        Mean (ms)
                                    </th>
                                    <th
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'right',
                                            color: THEME.textMuted,
                                            fontWeight: '500',
                                            fontSize: '12px',
                                        }}
                                    >
                                        Max (ms)
                                    </th>
                                    <th
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'right',
                                            color: THEME.textMuted,
                                            fontWeight: '500',
                                            fontSize: '12px',
                                        }}
                                    >
                                        StdDev
                                    </th>
                                    <th
                                        style={{
                                            padding: '20px 24px',
                                            textAlign: 'left',
                                            color: THEME.textMuted,
                                            fontWeight: '500',
                                            fontSize: '12px',
                                        }}
                                    >
                                        % of Total
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((q, idx) => {
                                    // FIX 3: Guard numeric fields against undefined before calling toFixed/toLocaleString
                                    const meanMs = parseFloat(q.mean_ms) || 0;
                                    const maxMs = parseFloat(q.max_ms) || 0;
                                    const stddevMs = parseFloat(q.stddev_ms) || 0;
                                    const pctTotal = parseFloat(q.pct_total) || 0;
                                    const calls = q.calls || 0;
                                    const meanColor = getMeanColor(meanMs);
                                    return (
                                        <tr
                                            key={idx}
                                            style={{
                                                borderBottom: `1px solid ${THEME.glassBorder}`,
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = THEME.surfaceHover;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            <td
                                                style={{
                                                    padding: '20px 24px',
                                                    color: THEME.textMain,
                                                    fontSize: '13px',
                                                    maxWidth: '350px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {q.query_preview}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '20px 24px',
                                                    textAlign: 'right',
                                                    color: THEME.textMain,
                                                    fontSize: '13px',
                                                }}
                                            >
                                                {calls.toLocaleString()}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '20px 24px',
                                                    textAlign: 'right',
                                                    color: meanColor,
                                                    fontSize: '13px',
                                                    fontWeight: '500',
                                                }}
                                            >
                                                {meanMs.toFixed(2)}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '20px 24px',
                                                    textAlign: 'right',
                                                    color: THEME.textMain,
                                                    fontSize: '13px',
                                                }}
                                            >
                                                {maxMs.toFixed(0)}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '20px 24px',
                                                    textAlign: 'right',
                                                    color: THEME.textMain,
                                                    fontSize: '13px',
                                                }}
                                            >
                                                {stddevMs.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '20px 24px', fontSize: '13px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div
                                                        style={{
                                                            flex: 1,
                                                            height: '6px',
                                                            background: THEME.glassBorder,
                                                            borderRadius: '3px',
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                height: '100%',
                                                                width: `${Math.min(pctTotal, 100)}%`,
                                                                background:
                                                                    pctTotal > 20 ? THEME.danger : THEME.secondary,
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: THEME.textMain,
                                                            fontSize: '12px',
                                                            minWidth: '40px',
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {pctTotal.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        color: THEME.textMuted,
                                                        fontSize: '11px',
                                                        marginTop: '4px',
                                                    }}
                                                >
                                                    This query accounts for {pctTotal.toFixed(1)}% of total query time
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// DB Activity Section
const DBActivitySection = ({ dbActivity }) => {
    if (!dbActivity || dbActivity.length === 0) {
        return (
            <div
                style={{
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: '12px',
                    padding: '32px',
                    textAlign: 'center',
                    color: THEME.textMuted,
                }}
            >
                No database activity data available
            </div>
        );
    }

    const chartData = dbActivity.map((db) => ({
        name: db.datname,
        // FIX 4: parseFloat already applied here — consistent
        cache_hit_pct: parseFloat(db.cache_hit_pct) || 0,
    }));

    return (
        <div>
            {/* Database Cards */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                }}
            >
                {dbActivity.map((db, idx) => {
                    // FIX 4: Parse cache_hit_pct and rollback_pct to numbers for correct comparison and toFixed
                    const cacheHitPct = parseFloat(db.cache_hit_pct) || 0;
                    const rollbackPct = parseFloat(db.rollback_pct) || 0;
                    const xactCommit = parseInt(db.xact_commit, 10) || 0;
                    const tempFiles = parseInt(db.temp_files, 10) || 0;
                    const deadlocks = parseInt(db.deadlocks, 10) || 0;

                    const cacheColor =
                        cacheHitPct > 95 ? THEME.success : cacheHitPct > 90 ? THEME.warning : THEME.danger;

                    return (
                        <div
                            key={idx}
                            className="slide-up"
                            style={{
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderRadius: '12px',
                                padding: '16px',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '12px',
                                }}
                            >
                                <div
                                    style={{
                                        color: THEME.textMain,
                                        fontWeight: '500',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <Database size={16} style={{ color: THEME.primary }} />
                                    {db.datname}
                                </div>
                                {deadlocks > 0 && (
                                    <div
                                        style={{
                                            background: THEME.danger,
                                            color: '#fff',
                                            fontSize: '10px',
                                            fontWeight: '600',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                        }}
                                    >
                                        {deadlocks} deadlock(s)
                                    </div>
                                )}
                            </div>

                            <div style={{ fontSize: '12px', display: 'grid', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: THEME.textMuted }}>Connections:</span>
                                    <span style={{ color: THEME.textMain, fontWeight: '500' }}>{db.numbackends}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: THEME.textMuted }}>Cache Hit:</span>
                                    <span style={{ color: cacheColor, fontWeight: '500' }}>
                                        {cacheHitPct.toFixed(1)}%
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: THEME.textMuted }}>Rollback Rate:</span>
                                    <span
                                        style={{
                                            color: rollbackPct > 5 ? THEME.warning : THEME.success,
                                            fontWeight: '500',
                                        }}
                                    >
                                        {rollbackPct.toFixed(2)}%
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: THEME.textMuted }}>Commits:</span>
                                    <span style={{ color: THEME.textMain, fontWeight: '500' }}>
                                        {xactCommit.toLocaleString()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: THEME.textMuted }}>Temp Files:</span>
                                    <span
                                        style={{
                                            color: tempFiles > 0 ? THEME.warning : THEME.success,
                                            fontWeight: '500',
                                        }}
                                    >
                                        {tempFiles}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Cache Hit Ratio Chart */}
            <div
                style={{
                    background: THEME.surface,
                    border: `1px solid ${THEME.glassBorder}`,
                    borderRadius: '12px',
                    padding: '24px',
                }}
            >
                <div style={{ marginBottom: '16px', color: THEME.textMain, fontWeight: '500' }}>
                    Cache Hit Ratio by Database
                </div>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                        <XAxis dataKey="name" stroke={THEME.textMuted} />
                        <YAxis stroke={THEME.textMuted} />
                        <Tooltip
                            contentStyle={{
                                background: THEME.surface,
                                border: `1px solid ${THEME.glassBorder}`,
                                borderRadius: '8px',
                                color: THEME.textMain,
                            }}
                        />
                        <Bar dataKey="cache_hit_pct" fill={THEME.secondary} radius={[8, 8, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

// Health Insights Panel
const HealthInsights = ({ data }) => {
    const insights = [];

    if (data.lockWaits && data.lockWaits.length > 0) {
        insights.push({
            type: 'warning',
            message: `Active lock contention detected — ${data.lockWaits.length} blocked session(s)`,
            icon: AlertTriangle,
        });
    }

    if (data.slowQueries && data.slowQueries.some((q) => parseFloat(q.pct_total) > 20)) {
        const maxQuery = data.slowQueries.reduce((max, q) =>
            parseFloat(q.pct_total) > parseFloat(max.pct_total) ? q : max,
        );
        insights.push({
            type: 'warning',
            message: `One query consuming ${parseFloat(maxQuery.pct_total).toFixed(1)}% of total query time`,
            icon: TrendingUp,
        });
    }

    if (data.dbActivity && data.dbActivity.length > 0) {
        const db = data.dbActivity[0];
        const cacheHitPct = parseFloat(db.cache_hit_pct) || 0;
        const deadlocks = parseInt(db.deadlocks, 10) || 0;
        if (cacheHitPct < 95) {
            insights.push({
                type: 'warning',
                message: `Low cache hit ratio ${cacheHitPct.toFixed(1)}% — consider increasing shared_buffers`,
                icon: Zap,
            });
        }
        if (deadlocks > 0) {
            insights.push({
                type: 'warning',
                message: `Deadlocks detected in ${db.datname}`,
                icon: Shield,
            });
        }
    }

    if (insights.length === 0) {
        insights.push({
            type: 'success',
            message: 'No critical issues detected',
            icon: CheckCircle,
        });
    }

    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: '12px',
                padding: '24px',
                marginTop: '24px',
            }}
        >
            <div style={{ color: THEME.textMain, fontWeight: '500', marginBottom: '16px' }}>Health Insights</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {insights.map((insight, idx) => {
                    const IconComponent = insight.icon;
                    const color = insight.type === 'warning' ? THEME.warning : THEME.success;
                    return (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                padding: '12px',
                                background: THEME.surface,
                                borderRadius: '8px',
                                borderLeft: `3px solid ${color}`,
                            }}
                        >
                            <IconComponent size={18} style={{ color, marginTop: '2px', flexShrink: 0 }} />
                            <div style={{ color: THEME.textMain, fontSize: '13px' }}>{insight.message}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Main Component
export default function LogPatternAnalysisTab() {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('wait-events');
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState('off');
    const [searchTerm, setSearchTerm] = useState('');

    // FIX 5: Wrap loadData in useCallback so it's stable and safe to use in the interval dependency array
    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('fathom_token');
            const result = await fetchData('/api/log-patterns/summary', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setData(result);
            setLastRefresh(new Date());
            setError(null);
        } catch (err) {
            setError(err.message || 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // FIX 6: Include loadData in the dependency array so the interval always calls the latest version
    useEffect(() => {
        if (autoRefresh === 'off') return;

        const interval = setInterval(loadData, autoRefresh === '30s' ? 30000 : 60000);
        return () => clearInterval(interval);
    }, [autoRefresh, loadData]);

    useGlobalRefresh(loadData);

    const lockWaitsCount = data?.lockWaits?.length || 0;
    const waitEventTypesCount = new Set((data?.waitEvents || []).map((e) => e.wait_event_type)).size;
    const slowQueriesCount = data?.slowQueries?.length || 0;
    // FIX 7: Parse cacheHitRatio as a number so toFixed() works correctly
    const cacheHitRatio = parseFloat(data?.dbActivity?.[0]?.cache_hit_pct) || 0;

    const getCacheHitColor = (value) => {
        if (value > 95) return THEME.success;
        if (value > 90) return THEME.warning;
        return THEME.danger;
    };

    return (
        <div style={{ padding: '24px', fontFamily: THEME.fontBody }}>
            <Styles />

            {/* Header */}
            <div
                className="fade-in"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '32px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileSearch size={28} style={{ color: THEME.primary }} />
                    <h1
                        style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: THEME.textMain,
                            margin: 0,
                        }}
                    >
                        Log Pattern Analysis
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: THEME.textMuted,
                            fontSize: '12px',
                        }}
                    >
                        <Clock size={14} />
                        Last refresh: {lastRefresh.toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div
                className="fade-in"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '32px',
                }}
            >
                <SummaryCard
                    label="Active Lock Waits"
                    value={lockWaitsCount}
                    color={lockWaitsCount > 0 ? THEME.danger : THEME.success}
                    isLoading={isLoading}
                />
                <SummaryCard
                    label="Wait Event Types"
                    value={waitEventTypesCount}
                    color={THEME.primary}
                    isLoading={isLoading}
                />
                <SummaryCard
                    label="Slow Query Patterns"
                    value={slowQueriesCount}
                    color={THEME.warning}
                    isLoading={isLoading}
                />
                <SummaryCard
                    label="Cache Hit Ratio"
                    value={`${cacheHitRatio.toFixed(1)}%`}
                    color={getCacheHitColor(cacheHitRatio)}
                    isLoading={isLoading}
                />
            </div>

            {error && (
                <div
                    style={{
                        background: `rgba(255, 69, 96, 0.1)`,
                        border: `1px solid ${THEME.danger}`,
                        borderRadius: '12px',
                        padding: '16px',
                        color: THEME.danger,
                        marginBottom: '24px',
                    }}
                >
                    Error: {error}
                </div>
            )}

            {/* Sub-tabs Navigation */}
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '24px',
                    borderBottom: `1px solid ${THEME.glassBorder}`,
                }}
            >
                {['wait-events', 'slow-queries', 'db-activity'].map((tab) => {
                    const labels = {
                        'wait-events': 'Wait Events',
                        'slow-queries': 'Slow Queries',
                        'db-activity': 'DB Activity',
                    };
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: isActive ? THEME.primary : THEME.textMuted,
                                padding: '20px 24px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: isActive ? '600' : '500',
                                borderBottom: isActive ? `2px solid ${THEME.primary}` : 'none',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.color = THEME.textMain;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.color = THEME.textMuted;
                                }
                            }}
                        >
                            {labels[tab]}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="fade-in">
                {activeTab === 'wait-events' && (
                    <div>
                        <h2 style={{ color: THEME.textMain, fontSize: '16px', marginBottom: '16px', marginTop: 0 }}>
                            Lock Waits
                        </h2>
                        <LockWaitsTable lockWaits={data?.lockWaits} />
                        <WaitEventBreakdown waitEvents={data?.waitEvents} />
                    </div>
                )}

                {activeTab === 'slow-queries' && (
                    <div>
                        <h2 style={{ color: THEME.textMain, fontSize: '16px', marginBottom: '16px', marginTop: 0 }}>
                            Slow Queries
                        </h2>
                        <SlowQueriesTable
                            slowQueries={data?.slowQueries}
                            searchTerm={searchTerm}
                            onSearchChange={setSearchTerm}
                        />
                    </div>
                )}

                {activeTab === 'db-activity' && (
                    <div>
                        <h2 style={{ color: THEME.textMain, fontSize: '16px', marginBottom: '16px', marginTop: 0 }}>
                            Database Activity
                        </h2>
                        <DBActivitySection dbActivity={data?.dbActivity} />
                    </div>
                )}
            </div>

            {/* Health Insights */}
            {data && <HealthInsights data={data} />}
        </div>
    );
}
