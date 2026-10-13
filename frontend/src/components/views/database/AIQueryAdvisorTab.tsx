import React, { useState, useEffect } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, postData } from '../../../utils/api';
import { Sparkles, Zap, AlertTriangle, CheckCircle, Search, Lightbulb, Target, RefreshCw } from 'lucide-react';

/* ── Styles ───────────────────────────────────────────────────────────────── */
const Styles = () => (
    <style>{`
        @keyframes aqSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes aqFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .aq-card { background:${THEME.surface}; border:1px solid ${THEME.grid}; border-radius: 20px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); backdrop-filter:blur(12px); transition:all 0.25s ease; animation:aqFade .3s ease; }
        .aq-card:hover { box-shadow:0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08); transform:translateY(-4px); }
        .aq-card-header { height:28px; background:${THEME.textMain}06; display:flex; align-items:center; padding:14px 20px; gap:6px; border-bottom:1px solid ${THEME.glassBorder}; font-weight:700; }
        .aq-card-dot { width:8px; height:8px; border-radius:50%; }
        .aq-card-title { font-family:'JetBrains Mono','Fira Code',monospace; font-size:11px; color:${THEME.textMuted}; margin-left:8px; letter-spacing:0.03em; }
        .aq-card-body { padding:20px 24px; box-shadow:inset 0 1px 3px rgba(0,0,0,0.05); }
        .aq-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .aq-textarea { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:14px 16px; color:${THEME.textMain}; font-size:13px; font-family:monospace; width:100%; resize:vertical; min-height:120px; }
        .aq-textarea:focus { outline:none; border-color:${THEME.primary}; }
        .aq-button { background:${THEME.primary}; color:${THEME.textInverse}; border:none; border-radius: 20px; padding:12px 20px; font-weight:700; font-size:13px; cursor:pointer; }
        .aq-button:hover { background:${THEME.primaryLight}; }
        .aq-button-secondary { background:${THEME.secondary}; }
        .aq-button-secondary:hover { background:${THEME.secondaryLight}; }
        .aq-suggestion-card { background:${THEME.grid}; border-left:4px solid; border-radius: 20px; padding:14px 16px; margin-bottom:14px; }
        .aq-severity-high { border-color:${THEME.danger}; }
        .aq-severity-medium { border-color:${THEME.warning}; }
        .aq-severity-low { border-color:${THEME.success}; }
        .aq-badge { display:inline-block; padding:4px 10px; border-radius: 20px; font-size:11px; font-weight:700; margin-right:8px; }
        .aq-badge-high { background:${THEME.danger}20; color:${THEME.danger}; }
        .aq-badge-medium { background:${THEME.warning}20; color:${THEME.warning}; }
        .aq-badge-low { background:${THEME.success}20; color:${THEME.success}; }
        .aq-gauge { width:100%; height:8px; background:${THEME.grid}; border-radius: 20px; overflow:hidden; }
        .aq-gauge-fill { height:100%; border-radius: 20px; transition:width 0.3s; }
        .aq-spinner { animation:aqSpin 1s linear infinite; }
    `}</style>
);

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const getComplexityColor = (score) => {
    if (score < 30) return THEME.success;
    if (score < 70) return THEME.warning;
    return THEME.danger;
};

const fmt = (n) => {
    if (n === null || n === undefined) return '—';
    try {
        return Number(n).toLocaleString();
    } catch {
        return '—';
    }
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI QUERY ADVISOR TAB
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AIQueryAdvisorTab() {
    useAdaptiveTheme();
    const [sqlQuery, setSqlQuery] = useState('SELECT * FROM pg_stat_statements LIMIT 10;');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTable, setSelectedTable] = useState('');
    const [indexRecs, setIndexRecs] = useState([]);
    const [error, setError] = useState(null);

    // Auto-discover slow queries
    const handleAutoDiscover = async () => {
        setLoading(true);
        try {
            const data = await fetchData('/api/ai-query/suggestions');
            const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
            setSuggestions(suggestions);
            setError(null);
        } catch (e) {
            setSuggestions([]);
            setError(e?.message || 'Failed to fetch suggestions');
        } finally {
            setLoading(false);
        }
    };

    // Analyze query
    const handleAnalyze = async () => {
        if (!sqlQuery.trim()) {
            setError('Please enter a SQL query');
            return;
        }
        setAnalyzing(true);
        try {
            const result = await postData('/api/ai-query/analyze', { query: sqlQuery });
            if (result && typeof result === 'object') {
                setAnalysis(result);
                setError(null);
            } else {
                setAnalysis(null);
                setError('Invalid analysis response');
            }
        } catch (e) {
            setAnalysis(null);
            setError(e?.message || 'Failed to analyze query');
        } finally {
            setAnalyzing(false);
        }
    };

    // Get index recommendations
    const handleGetIndexRecs = async () => {
        if (!selectedTable.trim()) {
            setError('Please enter a table name');
            return;
        }
        setLoading(true);
        try {
            const data = await fetchData(`/api/ai-query/indexes/${encodeURIComponent(selectedTable)}`);
            const recommendations = Array.isArray(data?.suggestions) ? data.suggestions
                : Array.isArray(data?.recommendations) ? data.recommendations : [];
            setIndexRecs(recommendations);
            setError(null);
        } catch (e) {
            setIndexRecs([]);
            setError(e?.message || 'Failed to fetch recommendations');
        } finally {
            setLoading(false);
        }
    };

    // Get full report
    const handleGetReport = async () => {
        try {
            const result = await fetchData('/api/ai-query/report');
            // Trigger download
            const element = document.createElement('a');
            element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(result, null, 2))}`);
            element.setAttribute('download', 'query-analysis-report.json');
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <div style={{ padding:'0 0 20px 0' }}>
            <Styles />

            {error && (
                <div style={{
                    background:`${THEME.danger}15`,
                    border:`1px solid ${THEME.danger}40`,
                    borderRadius:16,
                    padding:'14px 20px',
                    marginBottom:20,
                    color:THEME.danger,
                    fontSize:13
                }}>
                    <AlertTriangle size={16} style={{ display:'inline-block', marginRight:8, verticalAlign:'middle' }} />
                    {error}
                </div>
            )}

            {/* Query Input */}
            <div className="aq-card" style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:12 }}>
                    <Sparkles size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Analyze SQL Query
                </div>
                <div className="aq-label" style={{ marginBottom:12 }}>SQL Query</div>
                <textarea
                    className="aq-textarea"
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="Paste your SQL query here..."
                />
                <button className="aq-button" onClick={handleAnalyze} disabled={analyzing} style={{ marginTop:12 }}>
                    {analyzing ? <RefreshCw size={14} className="aq-spinner" style={{ marginRight:6 }} /> : <Zap size={14} style={{ marginRight:6 }} />}
                    {analyzing ? 'Analyzing...' : 'Analyze Query'}
                </button>
            </div>

            {/* Analysis Results */}
            {analysis && typeof analysis === 'object' && (
                <div className="aq-card" style={{ marginBottom:20 }}>
                    <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:20 }}>
                        <Zap size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                        Analysis Results
                    </div>

                    {/* Complexity Score */}
                    <div style={{ marginBottom:20 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:THEME.textMain, marginBottom:8 }}>
                            Complexity Score: <span style={{ color:getComplexityColor(analysis.complexityScore || 0) }}>{analysis.complexityScore || 0}/100</span>
                        </div>
                        <div className="aq-gauge">
                            <div className="aq-gauge-fill" style={{
                                width:`${Math.min(analysis.complexityScore || 0, 100)}%`,
                                background:getComplexityColor(analysis.complexityScore || 0)
                            }} />
                        </div>
                    </div>

                    {/* Optimization Suggestions */}
                    {Array.isArray(analysis.suggestions) && analysis.suggestions.length > 0 && (
                        <div style={{ marginBottom:20 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:THEME.textMain, marginBottom:12 }}>
                                <Lightbulb size={14} style={{ display:'inline-block', marginRight:6, verticalAlign:'middle' }} />
                                Optimization Suggestions
                            </div>
                            {analysis.suggestions.map((sug, i) => (
                                <div key={i} className={`aq-suggestion-card aq-severity-${sug?.severity || 'low'}`}>
                                    <div style={{ marginBottom:6 }}>
                                        <span className={`aq-badge aq-badge-${sug?.severity || 'low'}`}>{(sug?.severity || 'low').toUpperCase()}</span>
                                        <span style={{ color:THEME.textMain, fontWeight:700, fontSize:13 }}>{sug?.title || 'Suggestion'}</span>
                                    </div>
                                    <div style={{ color:THEME.textDim, fontSize:12 }}>{sug?.description || ''}</div>
                                    {sug?.recommendation && (
                                        <div style={{ marginTop:10, padding:10, background:`${THEME.surface}40`, borderRadius: 16, fontSize:12, color:THEME.textMuted }}>
                                            <strong>Recommendation:</strong> {sug.recommendation}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Anti-patterns */}
                    {Array.isArray(analysis.antiPatterns) && analysis.antiPatterns.length > 0 && (
                        <div>
                            <div style={{ fontSize:13, fontWeight:700, color:THEME.textMain, marginBottom:12 }}>
                                <AlertTriangle size={14} style={{ display:'inline-block', marginRight:6, verticalAlign:'middle' }} />
                                Anti-pattern Detection
                            </div>
                            {analysis.antiPatterns.map((ap, i) => (
                                <div key={i} style={{
                                    background:`${THEME.warning}15`,
                                    border:`1px solid ${THEME.warning}40`,
                                    borderRadius:16,
                                    padding:14,
                                    marginBottom:14,
                                    fontSize:12,
                                    color:THEME.warning
                                }}>
                                    <strong>{ap?.pattern || 'Pattern'}</strong> - {ap?.description || ''}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Auto-Discover Slow Queries */}
            <div className="aq-card" style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:16 }}>
                    <Search size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Auto-Discover Slow Queries
                </div>
                <p style={{ color:THEME.textMuted, fontSize:13, marginBottom:12 }}>
                    Find the slowest queries in your database and get optimization suggestions.
                </p>
                <button className="aq-button aq-button-secondary" onClick={handleAutoDiscover} disabled={loading}>
                    {loading ? <RefreshCw size={14} className="aq-spinner" style={{ marginRight:6 }} /> : <Search size={14} style={{ marginRight:6 }} />}
                    {loading ? 'Discovering...' : 'Discover Queries'}
                </button>

                {Array.isArray(suggestions) && suggestions.length > 0 && (
                    <div style={{ marginTop:16 }}>
                        {suggestions.map((sug, i) => (
                            <div key={i} className="aq-suggestion-card aq-severity-high">
                                <div style={{ color:THEME.textMain, fontWeight:700, fontSize:13, marginBottom:6 }}>
                                    {(sug?.query || '').substring(0, 60)}...
                                </div>
                                <div style={{ fontSize:12, color:THEME.textDim, marginBottom:6 }}>
                                    Avg Duration: {fmt(sug?.avgDuration)}ms | Calls: {fmt(sug?.calls)}
                                </div>
                                <div style={{ fontSize:11, color:THEME.textMuted }}>
                                    Suggestion: {sug?.suggestion || ''}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Index Recommendations */}
            <div className="aq-card" style={{ marginBottom:20 }}>
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:16 }}>
                    <Target size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Index Recommendations
                </div>
                <div className="aq-label">Table Name</div>
                <input
                    type="text"
                    style={{
                        background:THEME.surfaceHover,
                        border:`1px solid ${THEME.glassBorder}`,
                        borderRadius: 20,
                        padding:'12px 16px',
                        color:THEME.textMain,
                        fontSize:13,
                        width:'100%',
                        marginBottom:14
                    }}
                    placeholder="e.g., pg_stat_statements"
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                />
                <button className="aq-button" onClick={handleGetIndexRecs} disabled={loading} style={{ marginBottom:16 }}>
                    {loading ? <RefreshCw size={14} className="aq-spinner" style={{ marginRight:6 }} /> : <Target size={14} style={{ marginRight:6 }} />}
                    Get Recommendations
                </button>

                {Array.isArray(indexRecs) && indexRecs.length > 0 && (
                    <div>
                        {indexRecs.map((rec, i) => (
                            <div key={i} style={{
                                background:THEME.grid,
                                borderRadius:16,
                                padding:14,
                                marginBottom:14,
                                borderLeft:`4px solid ${THEME.success}`
                            }}>
                                <div style={{ color:THEME.textMain, fontWeight:700, fontSize:12, marginBottom:6, fontFamily:'monospace' }}>
                                    {rec?.indexName || 'Index'}
                                </div>
                                <div style={{ fontSize:11, color:THEME.textDim }}>
                                    <strong>Columns:</strong> {Array.isArray(rec?.columns) ? rec.columns.join(', ') : '—'}<br/>
                                    <strong>Expected Impact:</strong> {rec?.expectedImprovementPercent || 0}% faster
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Full Report */}
            <div className="aq-card">
                <div style={{ fontSize:16, fontWeight:700, color:THEME.textMain, marginBottom:12 }}>
                    <CheckCircle size={18} style={{ display:'inline-block', marginRight:10, verticalAlign:'middle' }} />
                    Generate Report
                </div>
                <p style={{ color:THEME.textMuted, fontSize:13, marginBottom:12 }}>
                    Download a comprehensive JSON report of all query analysis and recommendations.
                </p>
                <button className="aq-button aq-button-secondary" onClick={handleGetReport}>
                    <Zap size={14} style={{ marginRight:6 }} />
                    Download Full Report
                </button>
            </div>
        </div>
    );
}