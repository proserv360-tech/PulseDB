import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import {
    Brain,
    AlertTriangle,
    TrendingUp,
    Zap,
    Lock,
    Database,
    CheckCircle,
    RefreshCw,
    Send,
    ChevronRight,
    Lightbulb,
    Shield,
    Activity,
    AlertCircle,
    Search,
    Clock,
    BarChart2,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────── */
/* STYLES */
/* ─────────────────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes aimFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes aimPulse { 0%{opacity:1} 50%{opacity:0.6} 100%{opacity:1} }
        @keyframes aimGlow { 0%{box-shadow:0 0 0 0 ${THEME.primary}40} to{box-shadow:0 0 0 12px ${THEME.primary}00} }

        .aim-card {
            background: linear-gradient(180deg, ${THEME.surface} 0%, ${THEME.surface}f8 100%);
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            transition: all 0.25s ease;
            animation: aimFade 0.3s ease;
            backdrop-filter: blur(12px);
        }
        .aim-card:hover {
            box-shadow: 0 8px 28px rgba(0,0,0,0.12);
            transform: translateY(-4px);
        }
        .aim-card::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--tile-accent, ${THEME.primary});
            opacity: 0.7;
        }

        .aim-health-gauge {
            position: relative;
            width: 200px;
            height: 200px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }

        .aim-health-value {
            font-size: 48px;
            font-weight: 800;
            color: ${THEME.primary};
            z-index: 2;
        }

        .aim-health-label {
            font-size: 12px;
            color: ${THEME.textMuted};
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .aim-anomaly-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 22px;
            font-size: 12px;
            font-weight: 700;
            margin-right: 8px;
        }

        .aim-severity-critical {
            background: #fb7185 20%;
            color: #fb7185;
            border-left: 3px solid #fb7185;
        }

        .aim-severity-warning {
            background: #fbbf24 20%;
            color: #fbbf24;
            border-left: 3px solid #fbbf24;
        }

        .aim-severity-info {
            background: ${THEME.primary}20;
            color: ${THEME.primary};
            border-left: 3px solid ${THEME.primary};
        }

        .aim-input-group {
            display: flex;
            gap: 20px;
            align-items: stretch;
        }

        .aim-input {
            flex: 1;
            background: ${THEME.surfaceHover};
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            padding: 22px 28px;
            color: ${THEME.textMain};
            font-size: 14px;
        }

        .aim-input:focus {
            outline: none;
            border-color: ${THEME.primary};
            box-shadow: 0 0 0 2px ${THEME.primary}20;
        }

        .aim-btn {
            background: ${THEME.primary};
            color: ${THEME.surfaceHover};
            border: none;
            border-radius: 20px;
            padding: 12px 20px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 18px;
            font-size: 14px;
            transition: all 0.2s;
        }

        .aim-btn:hover {
            background: ${THEME.primaryHover};
            transform: translateY(-4px);
        }

        .aim-btn:active {
            transform: translateY(0);
        }

        .aim-suggestion-card {
            background: ${THEME.surfaceHover};
            border: 1px solid ${THEME.glassBorder};
            border-left: 3px solid ${THEME.primary};
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 12px;
            animation: aimFade 0.3s ease;
        }

        .aim-suggestion-title {
            font-weight: 700;
            color: ${THEME.textMain};
            display: flex;
            align-items: center;
            gap: 18px;
            margin-bottom: 8px;
        }

        .aim-suggestion-desc {
            font-size: 13px;
            color: ${THEME.textMuted};
            margin-bottom: 12px;
            line-height: 1.4;
        }

        .aim-suggestion-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 18px;
        }

        .aim-action-tag {
            display: inline-block;
            padding: 4px 10px;
            background: ${THEME.grid};
            border-radius: 20px;
            font-size: 12px;
            color: ${THEME.textMuted};
        }

        .aim-query-chip {
            display: inline-block;
            padding: 14px 20px;
            background: ${THEME.grid};
            border: 1px solid ${THEME.glassBorder};
            border-radius: 20px;
            font-size: 12px;
            color: ${THEME.textMain};
            cursor: pointer;
            transition: all 0.2s;
            margin-right: 8px;
            margin-bottom: 8px;
        }

        .aim-query-chip:hover {
            background: ${THEME.surfaceHover};
            border-color: ${THEME.primary};
            color: ${THEME.primary};
        }

        .aim-section {
            margin-bottom: 24px;
        }

        .aim-section-title {
            font-size: 14px;
            font-weight: 700;
            color: ${THEME.textMain};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 18px;
        }

        .aim-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .aim-modal {
            background: ${THEME.surface};
            border: 1px solid ${THEME.glassBorder};
            border-radius: 22px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: ${THEME.shadowLg};
        }

        .aim-modal-title {
            font-size: 18px;
            font-weight: 700;
            color: ${THEME.textMain};
            margin-bottom: 12px;
        }

        .aim-modal-body {
            font-size: 14px;
            color: ${THEME.textMuted};
            line-height: 1.6;
            margin-bottom: 20px;
        }

        .aim-modal-actions {
            display: flex;
            gap: 18px;
            justify-content: flex-end;
        }

        .aim-modal-btn {
            padding: 16px 22px;
            border-radius: 22px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-size: 14px;
        }

        .aim-modal-btn-primary {
            background: ${THEME.primary};
            color: ${THEME.surface};
        }

        .aim-modal-btn-primary:hover {
            background: ${THEME.primaryHover};
        }

        .aim-modal-btn-secondary {
            background: ${THEME.grid};
            color: ${THEME.textMain};
        }

        .aim-modal-btn-secondary:hover {
            background: ${THEME.gridDark};
        }

        .aim-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 18px;
            padding: 20px;
            color: ${THEME.textMuted};
            font-size: 14px;
        }

        .aim-spinner {
            animation: aimPulse 1.5s ease-in-out infinite;
        }

        .aim-error {
            background: ${THEME.danger}15;
            border: 1px solid ${THEME.danger};
            border-radius: 20px;
            padding: 16px;
            color: ${THEME.danger};
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 20px;
        }
    `}</style>
);

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPERS */
/* ─────────────────────────────────────────────────────────────────────────── */
const fmt = (n) => (n === null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));

const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 16,
                padding: '20px 24px',
                fontSize: 12,
                boxShadow: THEME.shadowSm,
            }}
        >
            {payload.map((p) => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600, marginBottom: 4 }}>
                    {p.name}: {fmt(p.value)}
                </div>
            ))}
        </div>
    );
};

const getHealthColor = (score) => {
    if (score >= 90) return THEME.success;
    if (score >= 75) return THEME.warning;
    if (score >= 50) return THEME.warning;
    return THEME.danger;
};

/* ═══════════════════════════════════════════════════════════════════════════ */
/* AI MONITORING TAB COMPONENT */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function AIMonitoringTab() {
    // State management
    const [healthScore, setHealthScore] = useState(null);
    const [anomalies, setAnomalies] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [patterns, setPatterns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // NL Query state
    const [question, setQuestion] = useState('');
    const [queryResults, setQueryResults] = useState(null);
    const [queryLoading, setQueryLoading] = useState(false);

    // Modal state for remediation
    const [selectedAnomaly, setSelectedAnomaly] = useState(null);
    const [remediationModal, setRemediationModal] = useState(null);
    const [remediating, setRemediating] = useState(false);

    const pollIntervalRef = useRef(null);

    /* Load initial data */
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);
                const [h, a, s, p] = await Promise.all([
                    fetchData('/api/ai-monitoring/health-score'),
                    fetchData('/api/ai-monitoring/anomalies'),
                    fetchData('/api/ai-monitoring/suggestions'),
                    fetchData('/api/ai-monitoring/patterns'),
                ]);

                setHealthScore(h);
                setAnomalies(a?.anomalies || []);
                setSuggestions(s?.suggestions || []);
                setPatterns(p?.patterns || []);
                setError(null);
            } catch (err) {
                setError(err.message || 'Failed to load monitoring data');
                log('ERROR', 'Failed to load AI monitoring data', { error: err.message });
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();

        // Poll for updates every 30 seconds
        pollIntervalRef.current = setInterval(loadInitialData, 30000);
        return () => clearInterval(pollIntervalRef.current);
    }, []);

    /* Handle natural language queries */
    const handleAskQuestion = useCallback(async () => {
        if (!question.trim()) return;

        try {
            setQueryLoading(true);
            const result = await postData('/api/ai-monitoring/ask', { question });
            setQueryResults(result);
            setError(null);
        } catch (err) {
            setError(err.message);
            log('ERROR', 'Failed to process question', { error: err.message });
        } finally {
            setQueryLoading(false);
        }
    }, [question]);

    /* Handle remediation action */
    const handleRemediate = useCallback(async (action) => {
        try {
            setRemediating(true);
            const result = await postData('/api/ai-monitoring/remediate', { action, confirm: true });
            alert(`Remediation: ${result.message}`);
            setRemediationModal(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setRemediating(false);
        }
    }, []);

    /* Suggested questions */
    const suggestedQuestions = [
        'What are the slowest queries?',
        'Show me table bloat',
        'Check replication lag',
        'How many active connections?',
        'Database health status',
    ];

    if (loading) {
        return (
            <>
                <Styles />
                <div style={{ padding: 40, textAlign: 'center' }}>
                    <div className="aim-loading">
                        <Brain className="aim-spinner" size={20} />
                        Loading AI monitoring...
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Styles />
            <div style={{ padding: '0 0 20px 0' }}>
                {/* Error Banner */}
                {error && (
                    <div className="aim-error">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Health Score Panel */}
                <div className="aim-section">
                    <h3 className="aim-section-title">
                        <Activity size={16} /> Database Health
                    </h3>
                    <div className="aim-card" style={{ textAlign: 'center', padding: 30 }}>
                        <div
                            className="aim-health-gauge"
                            style={{
                                background: `conic-gradient(${getHealthColor(healthScore?.score || 0)} 0deg ${(healthScore?.score || 0) * 3.6}deg, ${THEME.grid} ${(healthScore?.score || 0) * 3.6}deg 360deg)`,
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    width: 160,
                                    height: 160,
                                    background: THEME.surface,
                                    borderRadius: '50%',
                                }}
                            />
                            <div style={{ position: 'relative', textAlign: 'center' }}>
                                <div className="aim-health-value">{healthScore?.score || 0}</div>
                                <div className="aim-health-label">Health Score</div>
                            </div>
                        </div>

                        {/* Component breakdown */}
                        <div
                            style={{
                                marginTop: 30,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: 22,
                            }}
                        >
                            {healthScore?.components &&
                                Object.entries(healthScore.components).map(([key, value]) => (
                                    <div key={key} style={{ padding: 12, background: THEME.grid, borderRadius: 20 }}>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: THEME.textMuted,
                                                marginBottom: 4,
                                                textTransform: 'capitalize',
                                            }}
                                        >
                                            {key}
                                        </div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: getHealthColor(value) }}>
                                            {Math.round(value)}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

                {/* Anomalies Feed */}
                <div className="aim-section">
                    <h3 className="aim-section-title">
                        <AlertTriangle size={16} /> Detected Anomalies ({anomalies.length})
                    </h3>
                    {anomalies.length === 0 ? (
                        <div className="aim-card" style={{ textAlign: 'center', padding: 40, color: THEME.textMuted }}>
                            <CheckCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                            <div>No anomalies detected</div>
                        </div>
                    ) : (
                        <div>
                            {anomalies.map((anom, idx) => (
                                <div key={idx} className="aim-card" style={{ marginBottom: 12 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: 10,
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}>
                                                {anom.description}
                                            </div>
                                            <div style={{ fontSize: 12, color: THEME.textMuted }}>
                                                Value: {fmt(anom.value)} • Z-Score: {anom.zScore} •{' '}
                                                {new Date(anom.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className={`aim-anomaly-badge aim-severity-${anom.severity}`}>
                                            {anom.severity.toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Remediation & Optimization */}
                <div className="aim-section">
                    <h3 className="aim-section-title">
                        <Lightbulb size={16} /> Optimization Suggestions
                    </h3>
                    {suggestions.length === 0 ? (
                        <div className="aim-card" style={{ textAlign: 'center', padding: 30, color: THEME.textMuted }}>
                            No suggestions available
                        </div>
                    ) : (
                        <div>
                            {suggestions.map((sugg) => (
                                <div key={sugg.id} className="aim-suggestion-card">
                                    <div className="aim-suggestion-title">
                                        <Zap
                                            size={14}
                                            style={{
                                                color:
                                                    sugg.priority === 'high'
                                                        ? THEME.danger
                                                        : sugg.priority === 'medium'
                                                          ? THEME.warning
                                                          : THEME.primary,
                                            }}
                                        />
                                        {sugg.title}
                                    </div>
                                    <div className="aim-suggestion-desc">{sugg.description}</div>
                                    <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 12 }}>
                                        <strong>Impact:</strong> {sugg.impact}
                                    </div>
                                    <div className="aim-suggestion-actions">
                                        {sugg.actions?.map((action, idx) => (
                                            <div key={idx} className="aim-action-tag">
                                                {action}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detected Patterns */}
                <div className="aim-section">
                    <h3 className="aim-section-title">
                        <TrendingUp size={16} /> Detected Patterns
                    </h3>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: 22,
                        }}
                    >
                        {patterns.map((pattern) => (
                            <div key={pattern.id} className="aim-card">
                                <div style={{ fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                                    {pattern.name}
                                </div>
                                <div
                                    style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 12, lineHeight: 1.4 }}
                                >
                                    {pattern.description}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        padding: 8,
                                        background: THEME.grid,
                                        borderRadius: 18,
                                        marginBottom: 8,
                                        color: THEME.textMuted,
                                    }}
                                >
                                    <strong>Impact:</strong> {pattern.impact}
                                </div>
                                <div style={{ fontSize: 12, color: THEME.primary }}>
                                    <strong>Recommendation:</strong> {pattern.recommendation}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Natural Language Query Interface */}
                <div className="aim-section">
                    <h3 className="aim-section-title">
                        <Search size={16} /> Ask Database
                    </h3>
                    <div className="aim-card">
                        <div className="aim-input-group">
                            <input
                                type="text"
                                className="aim-input"
                                placeholder="Ask a question about your database..."
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                            />
                            <button className="aim-btn" onClick={handleAskQuestion} disabled={queryLoading}>
                                {queryLoading ? (
                                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <Send size={16} />
                                )}
                                Ask
                            </button>
                        </div>

                        {/* Suggested questions */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 8 }}>Try asking:</div>
                            <div>
                                {suggestedQuestions.map((q) => (
                                    <div
                                        key={q}
                                        className="aim-query-chip"
                                        onClick={() => {
                                            setQuestion(q);
                                        }}
                                    >
                                        {q}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Query results */}
                        {queryResults && (
                            <div style={{ marginTop: 20, padding: 16, background: THEME.grid, borderRadius: 20 }}>
                                <div style={{ fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                                    {queryResults.interpretation || queryResults.error || 'Result'}
                                </div>
                                {queryResults.explanation && (
                                    <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 12 }}>
                                        {queryResults.explanation}
                                    </div>
                                )}
                                {queryResults.results && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: THEME.textMain,
                                            fontFamily: 'monospace',
                                            overflowX: 'auto',
                                        }}
                                    >
                                        <pre>{JSON.stringify(queryResults.results.slice(0, 5), null, 2)}</pre>
                                    </div>
                                )}
                                {queryResults.error && <div style={{ color: THEME.danger }}>{queryResults.error}</div>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
