import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { THEME, useAdaptiveTheme, metricValue } from '../../../utils/theme';
import { postData, fetchData } from '../../../utils/api';
import { setLatestPlan } from './queryPlanStore';
import QueryPlanViewer from './QueryPlanViewer';
import {
    Zap, Search, Play, Clock, Database, Server,
    AlertTriangle, CheckCircle, ArrowRight, Activity,
    Layers, Cpu, HardDrive, Filter, TrendingUp,
    History, Save, ChevronRight, ChevronDown,
    Maximize2, Minimize2, Info, X, Share2,
    FileText, Settings, BarChart3, HelpCircle,
    Target, Sparkles, AlertCircle, ArrowUpRight,
    GitCompare, Lightbulb, RefreshCw, Users,
    Eye, Code2, Table, Columns, Plus, Trash2,
    ChevronLeft, Download, Copy, Check, BookOpen,
    Terminal, TrendingDown, Gauge, Network,
    Lock, Unlock, Star, Hash, Flame, Tag,
    Wrench, ShieldAlert, SlidersHorizontal,
    TimerReset, Workflow, PackageOpen, Boxes,
    SquareSlash, CircleDot, Siren, Hourglass,
    XCircle, RotateCcw, Award, Percent,
    Wand2, Package, AlertOctagon, Layers3,
    PieChart, Building2, Microscope
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const OptimizerStyles = () => (
    <style>{`
        @keyframes optFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes optSlideRight { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes optPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes optGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes optSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes scoreReveal { from { stroke-dashoffset: 283; } to { } }
        @keyframes flamePop { 0% { transform: scaleY(0); transform-origin: bottom; } 100% { transform: scaleY(1); } }
        @keyframes aiTyping { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes heatPulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        .opt-card {
            background: ${THEME.surface};
            border: 1px solid ${THEME.grid};
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            backdrop-filter: blur(12px);
            transition: all 0.25s ease;
        }
        .opt-card:hover {
            box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
            transform: translateY(-4px);
        }
        .opt-card-header {
            height: 28px;
            background: ${THEME.textMain}06;
            display: flex;
            align-items: center;
            padding: 14px 20px;
            gap: 6px;
            border-bottom: 1px solid ${THEME.glassBorder};
            font-weight: 700;
        }
        .opt-card-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .opt-card-title {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 11px;
            color: ${THEME.textMuted};
            margin-left: 8px;
            letter-spacing: 0.03em;
        }
        .opt-card-body {
            padding: 24px 30px;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }
        .opt-card.legacy {
            padding: 20px;
        }
        .opt-tab-btn { transition: all 0.18s; cursor: pointer; }
        .opt-tab-btn:hover { opacity: 1 !important; }
        .plan-node { position: relative; transition: all 0.2s; }
        .plan-node:hover > .node-content {
            transform: translateY(-4px);
            box-shadow: 0 6px 20px ${THEME.primary}15;
            border-color: ${THEME.primary}50;
        }
        .plan-tree-line {
            position: absolute;
            left: 24px; top: 40px; bottom: -20px;
            width: 2px;
            background: linear-gradient(180deg, ${THEME.grid}80, transparent);
        }
        .stat-bar-bg { background: ${THEME.grid}; border-radius: 3px; overflow: hidden; height: 4px; }
        .stat-bar-fill {
            height: 100%; border-radius: 20px;
            animation: optGrow 0.8s cubic-bezier(0.4,0,0.2,1) forwards;
            transform-origin: left;
        }
        .sql-editor {
            font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
            caret-color: ${THEME.primary};
            line-height: 1.7;
        }
        .sql-editor::selection { background: ${THEME.primary}30; }
        .opt-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .opt-scroll::-webkit-scrollbar-thumb { background: ${THEME.grid}; border-radius: 3px; }
        .opt-scroll::-webkit-scrollbar-thumb:hover { background: ${THEME.textDim}; }
        .opt-row-hover:hover { background: ${THEME.primary}08 !important; }
        .opt-btn { transition: all 0.15s; cursor: pointer; }
        .opt-btn:hover { filter: brightness(1.15); transform: translateY(-3px); }
        .opt-btn:active { transform: translateY(0); filter: brightness(0.95); }
        .skeleton {
            background: linear-gradient(90deg, ${THEME.surface} 25%, ${THEME.grid}60 50%, ${THEME.surface} 75%);
            background-size: 200% 100%;
            animation: shimmer 1.4s infinite;
        }
        .active-user-dot {
            width: 7px; height: 7px; border-radius: 50%;
            background: ${THEME.danger};
            animation: optPulse 1.5s infinite;
            display: inline-block; flex-shrink: 0;
        }
        .flame-bar {
            transform-origin: bottom;
            animation: flamePop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .score-ring {
            animation: scoreReveal 1.2s cubic-bezier(0.4,0,0.2,1) forwards;
        }
        .lock-chain-line {
            stroke: ${THEME.danger};
            stroke-dasharray: 4 3;
            animation: optPulse 2s infinite;
        }
        .config-row-changed { background: ${THEME.warning}08 !important; }
        .tag-pill {
            padding: 2px 6px; border-radius: 22px; font-size: 9px; font-weight: 700;
            cursor: pointer; transition: all 0.15s;
        }
        .tag-pill:hover { filter: brightness(1.2); }
        .heat-node-critical { animation: heatPulse 2s infinite; }
        .ai-cursor::after { content:'▋'; animation: aiTyping 0.8s infinite; }
        .diff-added { background: ${THEME.success}15; border-left: 3px solid ${THEME.success}; }
        .diff-removed { background: ${THEME.danger}10; border-left: 3px solid ${THEME.danger}; }
        .param-highlight { background: ${THEME.warning}30; border-radius: 3px; padding: 0 2px; color: ${THEME.warning}; font-weight: 700; }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
const formatDuration = (ms) => {
    if (!ms && ms !== 0) return '—';
    if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(2)}ms`;
};
const formatRows = (num) => {
    if (num === undefined || num === null) return '—';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
    return num.toString();
};
const formatBytes = (b) => {
    if (!b) return '0 B';
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
};
const getCostColor = (ratio) => {
    if (ratio > 0.7) return THEME.danger;
    if (ratio > 0.35) return THEME.warning;
    return THEME.success;
};
const getSeverityIcon = (type) => {
    if (type === 'danger') return <AlertTriangle size={13} color={THEME.danger} />;
    if (type === 'warning') return <AlertCircle size={13} color={THEME.warning} />;
    if (type === 'info') return <Info size={13} color={THEME.info || THEME.primary} />;
    return <CheckCircle size={13} color={THEME.success} />;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const generateMockPlan = (query) => {
    return null;
};

const indexes = [];

const tableStats = [];

const SAMPLE_QUERIES = [];

const slowQueries = [];

const locks = [];

const maintenance = [];

const pgConfig = [];

// NEW: Mock service attribution data
const serviceAttribution = [];

// NEW: Mock parameterization advisor data
const paramIssues = [];

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYSIS ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */
const analyzePlan = (result) => {
    const insights = [], indexRecommendations = [], rewrites = [];

    const walk = (node) => {
        if (!node) return;
        if (node["Node Type"] === "Seq Scan") {
            const rows = node["Actual Rows"] || node["Plan Rows"] || 0;
            if (rows > 1000 || (node["Total Cost"] || 0) > 50) {
                insights.push({ type: 'danger', category: 'Performance', title: 'Full Table Scan Detected', desc: `Sequential scan on "${node["Relation Name"]}" reading ${formatRows(rows)} rows. An index on filter/join columns would dramatically reduce I/O.`, node: node["Relation Name"], impact: 'HIGH', fix: `CREATE INDEX CONCURRENTLY idx_${node["Relation Name"]}_filter\n  ON ${node["Relation Name"]} (active); -- adjust column name` });
                indexRecommendations.push({ table: node["Relation Name"], suggestion: `CREATE INDEX CONCURRENTLY idx_${node["Relation Name"]}_filter\n  ON ${node["Relation Name"]} (/* your filter column */);`, reason: `Eliminates sequential scan of ${formatRows(rows)} rows`, estimatedGain: '60–90% cost reduction' });
            }
        }
        if (node["Actual Rows"] > 0 && node["Plan Rows"] > 0) {
            const ratio = Math.abs(node["Actual Rows"] - node["Plan Rows"]) / node["Actual Rows"];
            if (ratio > 5) insights.push({ type: 'danger', category: 'Statistics', title: 'Stale Planner Statistics', desc: `Planner expected ${formatRows(node["Plan Rows"])} rows but got ${formatRows(node["Actual Rows"])}. Run ANALYZE to refresh stats.`, node: node["Relation Name"], impact: 'HIGH', fix: `ANALYZE ${node["Relation Name"] || ''};` });
        }
        if (node["Node Type"] === "Hash Join" && (node["Temp Written Blocks"] || 0) > 0) {
            insights.push({ type: 'warning', category: 'Memory', title: 'Hash Join Spilling to Disk', desc: `Wrote ${node["Temp Written Blocks"]} temp blocks to disk. Increasing work_mem will keep this in RAM.`, impact: 'MEDIUM', fix: `SET work_mem = '${Math.max(64, ((node["Temp Written Blocks"] || 0) * 8 / 1024 * 4)).toFixed(0)}MB';` });
        }
        if (node["Node Type"] === "Nested Loop" && (node["Actual Rows"] || 0) > 10000) {
            insights.push({ type: 'warning', category: 'Join Strategy', title: 'Nested Loop on Large Dataset', desc: `Nested loop with ${formatRows(node["Actual Rows"])} rows is O(n²). Hash Join may be more efficient for this cardinality.`, impact: 'MEDIUM', fix: `SET enable_nestloop = off; -- force planner to try alternatives` });
        }
        if ((node["Rows Removed by Filter"] || 0) > (node["Actual Rows"] || 1) * 2) {
            insights.push({ type: 'warning', category: 'Filter Efficiency', title: 'High Filter Rejection Rate', desc: `Filter removed ${formatRows(node["Rows Removed by Filter"])} rows from "${node["Relation Name"]}". A partial or composite index would reduce rows read.`, node: node["Relation Name"], impact: 'MEDIUM' });
        }
        if ((node["Workers Launched"] === 0) && (node["Actual Total Time"] || 0) > 500) {
            insights.push({ type: 'info', category: 'Parallelism', title: 'Parallel Query Not Used', desc: 'This slow query ran single-threaded. Raising max_parallel_workers_per_gather may help.', impact: 'LOW', fix: `SET max_parallel_workers_per_gather = 4;` });
        }
        if (node.Plans) node.Plans.forEach(walk);
    };

    walk(result?.Plan);

    rewrites.push({ title: 'Use a covering index to avoid heap fetch', desc: 'Include all projected columns in the index to avoid going back to the table (Index-Only Scan).', example: `CREATE INDEX CONCURRENTLY idx_orders_cover\n  ON orders (user_id)\n  INCLUDE (id, total, status, created_at);` });

    if (insights.some(i => i.category === 'Statistics')) {
        rewrites.push({ title: 'Refresh table statistics', desc: 'Planner estimates are stale. Run targeted ANALYZE or adjust autovacuum thresholds.', example: `ANALYZE users;\nANALYZE orders;\n\n-- For high-write tables, lower autovacuum threshold:\nALTER TABLE orders SET (\n  autovacuum_analyze_scale_factor = 0.01\n);` });
    }

    return { insights, indexRecommendations, rewrites };
};

// NEW: Get heatmap data — find most expensive node by time
const getHeatmapData = (plan) => {
    const nodes = [];
    const walk = (node, path = '') => {
        if (!node) return;
        const id = `${node["Node Type"]}-${node["Relation Name"] || ''}-${path}`;
        nodes.push({ id, time: node["Actual Total Time"] || 0, cost: node["Total Cost"] || 0 });
        if (node.Plans) node.Plans.forEach((p, i) => walk(p, `${path}-${i}`));
    };
    walk(plan);
    const maxTime = nodes.length > 0 ? Math.max(...nodes.map(n => n.time), 1) : 1;
    const result = {};
    nodes.forEach(n => { result[n.id] = n.time / maxTime; });
    return { heatmap: result, maxTime, hotNodeId: nodes.length > 0 ? nodes.reduce((a, b) => a.time > b.time ? a : b, nodes[0])?.id : null };
};

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

// Recursive plan tree node — enhanced with heatmap overlay
const PlanNode = ({ node, maxCost, totalTime, depth = 0, heatmapData, showHeatmap }) => {
    const [expanded, setExpanded] = useState(true);
    const costRatio = node["Total Cost"] / (maxCost || 1);
    const timeRatio = (node["Actual Total Time"] || 0) / (totalTime || 1);
    const isSeqScan = node["Node Type"] === "Seq Scan";
    const color = getCostColor(costRatio);

    const nodeId = `${node["Node Type"]}-${node["Relation Name"] || ''}-${depth}`;
    const heatRatio = heatmapData?.[nodeId] || timeRatio;
    const isHotspot = showHeatmap && heatRatio > 0.7;
    const heatColor = showHeatmap
        ? `rgba(${Math.round(220 * heatRatio)}, ${Math.round(60 * (1 - heatRatio))}, ${Math.round(40 * (1 - heatRatio))}, ${0.15 + heatRatio * 0.25})`
        : undefined;

    const misest = node["Actual Rows"] > 0
        ? Math.abs((node["Plan Rows"] || 0) - node["Actual Rows"]) / node["Actual Rows"]
        : 0;
    const badEstimate = misest > 5;

    const NodeIcon = useMemo(() => {
        const t = node["Node Type"];
        if (t.includes("Scan")) return Search;
        if (t.includes("Join") || t.includes("Loop")) return Network;
        if (t.includes("Sort")) return Filter;
        if (t.includes("Aggregate") || t.includes("Group")) return BarChart3;
        if (t.includes("Hash")) return Hash;
        return Activity;
    }, [node]);

    return (
        <div className="plan-node" style={{ paddingLeft: depth ? 32 : 0, position: 'relative' }}>
            {depth > 0 && (
                <div style={{ position: 'absolute', left: 0, top: 24, width: 24, height: 2, background: `${THEME.grid}80` }} />
            )}
            {node.Plans && expanded && (
                <div className="plan-tree-line" style={{ left: depth ? 56 : 24 }} />
            )}

            <div
                className={`node-content opt-card ${isHotspot ? 'heat-node-critical' : ''}`}
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                style={{
                    padding: '22px 28px', borderRadius: 16, marginBottom: 10,
                    cursor: 'pointer', borderLeft: `4px solid ${showHeatmap ? (isHotspot ? THEME.danger : THEME.warning) : color}`,
                    background: showHeatmap && heatColor ? heatColor : `linear-gradient(135deg, ${THEME.surface}f8 0%, ${THEME.surface}ee 100%)`,
                    position: 'relative', overflow: 'hidden'
                }}
            >
                {/* Heatmap intensity bar (top) */}
                {showHeatmap && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `rgba(${Math.round(220 * heatRatio)}, ${Math.round(40 * (1 - heatRatio))}, 0, ${heatRatio})`, borderRadius: '10px 10px 0 0' }} />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 18, background: showHeatmap ? `rgba(${Math.round(220 * heatRatio)}, ${Math.round(60 * (1-heatRatio))}, 0, 0.2)` : `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <NodeIcon size={14} color={showHeatmap ? (isHotspot ? THEME.danger : THEME.warning) : color} />
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {node["Node Type"]}
                                {node["Relation Name"] && <span style={{ fontSize: 10, color: THEME.textDim, fontWeight: 400 }}>→ {node["Relation Name"]}</span>}
                                {node["Index Name"] && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 16, background: `${THEME.success}20`, color: THEME.success, fontWeight: 700 }}>IDX</span>}
                                {badEstimate && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 16, background: `${THEME.danger}20`, color: THEME.danger, fontWeight: 700 }}>MISEST</span>}
                                {node["Parallel Aware"] && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 16, background: `${THEME.primary}20`, color: THEME.primary, fontWeight: 700 }}>PARALLEL</span>}
                                {isHotspot && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 16, background: `${THEME.danger}25`, color: THEME.danger, fontWeight: 700 }}>🔥 HOTSPOT</span>}
                            </div>
                            <div style={{ fontSize: 10, color: THEME.textMuted, display: 'flex', gap: 22, marginTop: 3, flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {formatDuration(node["Actual Total Time"] || 0)}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Database size={9} /> {formatRows(node["Actual Rows"] || 0)} rows</span>
                                {badEstimate && <span style={{ color: THEME.danger, fontSize: 9 }}>est: {formatRows(node["Plan Rows"])}</span>}
                                {node["Filter"] && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: THEME.warning }}><Filter size={9} /> {node["Filter"]}</span>}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: showHeatmap ? (isHotspot ? THEME.danger : THEME.warning) : color }}>{node["Total Cost"].toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: THEME.textMuted }}>{(costRatio * 100).toFixed(0)}% total</div>
                        {showHeatmap && <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 1 }}>{(heatRatio * 100).toFixed(0)}% time</div>}
                        {node.Plans && <div style={{ marginTop: 3, color: THEME.textMuted }}>{expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</div>}
                    </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 3 }}>
                    <div style={{ flex: 1, minWidth: 0, height: 3, background: `${THEME.grid}40`, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, costRatio * 100)}%`, height: '100%', background: color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, height: 3, background: `${THEME.grid}40`, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, timeRatio * 100)}%`, height: '100%', background: showHeatmap ? `rgba(${Math.round(220 * heatRatio)},${Math.round(60*(1-heatRatio))},0,0.8)` : THEME.primary }} />
                    </div>
                </div>
            </div>

            {expanded && node.Plans && (
                <div style={{ animation: 'optFadeIn 0.2s' }}>
                    {node.Plans.map((child, i) => (
                        <PlanNode key={i} node={child} maxCost={maxCost} totalTime={totalTime} depth={depth + 1} heatmapData={heatmapData} showHeatmap={showHeatmap} />
                    ))}
                </div>
            )}
        </div>
    );
};

// Cost bar chart
const CostBreakdownChart = ({ plan }) => {
    const nodes = [];
    const flatten = (n) => {
        if (!n) return;
        nodes.push({
            label: `${n["Node Type"]}${n["Relation Name"] ? ` (${n["Relation Name"]})` : ''}`,
            cost: n["Total Cost"], time: n["Actual Total Time"] || 0
        });
        if (n.Plans) n.Plans.forEach(flatten);
    };
    flatten(plan?.Plan);
    const maxCost = nodes.length > 0 ? Math.max(...nodes.map(n => n.cost), 1) : 1;
    const maxTime = nodes.length > 0 ? Math.max(...nodes.map(n => n.time), 1) : 1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
                <div style={{ width: 140 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 9, color: THEME.textDim, fontWeight: 700 }}>Cost</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 9, color: THEME.textDim, fontWeight: 700 }}>Time</div>
            </div>
            {nodes.slice(0, 8).map((n, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 140, fontSize: 10, color: THEME.textMuted, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0, height: 10, background: `${THEME.grid}40`, borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ width: `${(n.cost / maxCost) * 100}%`, height: '100%', background: getCostColor(n.cost / maxCost), borderRadius: 3 }} />
                        </div>
                        <span style={{ width: 48, fontSize: 9, color: THEME.textMuted, textAlign: 'right' }}>{n.cost.toFixed(1)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0, height: 10, background: `${THEME.grid}40`, borderRadius: 16, overflow: 'hidden' }}>
                            <div style={{ width: `${(n.time / maxTime) * 100}%`, height: '100%', background: THEME.primary, borderRadius: 3 }} />
                        </div>
                        <span style={{ width: 48, fontSize: 9, color: THEME.textMuted, textAlign: 'right' }}>{formatDuration(n.time)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Analysis Insights Panel
const InsightsPanel = ({ insights, rewrites, indexRecs }) => {
    const [section, setSection] = useState('issues');
    const [copiedIdx, setCopiedIdx] = useState(null);
    const copy = (text, key) => { navigator.clipboard?.writeText(text).catch(() => {}); setCopiedIdx(key); setTimeout(() => setCopiedIdx(null), 1800); };

    const tabs = [
        { id: 'issues', label: 'Issues', count: insights.length },
        { id: 'indexes', label: 'Index Recs', count: indexRecs.length },
        { id: 'rewrites', label: 'Rewrites', count: rewrites.length },
    ];
    const sorted = [...insights].sort((a, b) => ({ danger: 0, warning: 1, info: 2 }[a.type] - ({ danger: 0, warning: 1, info: 2 }[b.type] ?? 3)));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 2, padding: '20px 24px', borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setSection(t.id)} className="opt-tab-btn" style={{
                        padding: '4px 10px', borderRadius: 16, border: 'none', fontSize: 10, fontWeight: 600,
                        background: section === t.id ? `${THEME.primary}25` : 'transparent',
                        color: section === t.id ? THEME.primary : THEME.textDim, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5
                    }}>
                        {t.label}
                        {t.count > 0 && (
                            <span style={{ background: section === t.id ? THEME.primary : THEME.grid, color: section === t.id ? '#fff' : THEME.textMuted, borderRadius: 20, padding: '0 5px', fontSize: 8, fontWeight: 700 }}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                {section === 'issues' && (
                    <>
                        {sorted.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 24, color: THEME.textDim }}>
                                <CheckCircle size={26} color={THEME.success} style={{ display: 'block', margin: '0 auto 8px' }} />
                                <div style={{ fontSize: 12, fontWeight: 600 }}>No issues found</div>
                                <div style={{ fontSize: 10, marginTop: 4 }}>Query plan looks optimal</div>
                            </div>
                        )}
                        {sorted.map((item, i) => (
                            <div key={i} style={{
                                marginBottom: 10, padding: 11, borderRadius: 20,
                                background: item.type === 'danger' ? `${THEME.danger}08` : item.type === 'warning' ? `${THEME.warning}08` : `${THEME.primary}08`,
                                border: `1px solid ${item.type === 'danger' ? THEME.danger : item.type === 'warning' ? THEME.warning : THEME.primary}25`,
                                animation: `optFadeIn 0.3s ${i * 0.04}s both`
                            }}>
                                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 5 }}>
                                    {getSeverityIcon(item.type)}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMain }}>{item.title}</div>
                                        <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 1,  letterSpacing: '0.04em' }}>{item.category} · {item.impact} IMPACT</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.5, marginBottom: item.fix ? 8 : 0 }}>{item.desc}</div>
                                {item.fix && (
                                    <div style={{ position: 'relative' }}>
                                        <pre style={{ fontSize: 9, fontFamily: 'monospace', background: `${THEME.bg}80`, borderRadius: 16, padding: '6px 28px 6px 8px', color: THEME.success, margin: 0, whiteSpace: 'pre-wrap', border: `1px solid ${THEME.grid}40` }}>{item.fix}</pre>
                                        <button onClick={() => copy(item.fix, `fix-${i}`)} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 2 }}>
                                            {copiedIdx === `fix-${i}` ? <Check size={10} color={THEME.success} /> : <Copy size={10} />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}

                {section === 'indexes' && (
                    indexRecs.length === 0
                        ? <div style={{ textAlign: 'center', padding: 24, color: THEME.textDim, fontSize: 12 }}>No index recommendations</div>
                        : indexRecs.map((rec, i) => (
                            <div key={i} style={{ marginBottom: 10, padding: 11, borderRadius: 20, background: `${THEME.primary}06`, border: `1px solid ${THEME.primary}20` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                    <Layers size={12} color={THEME.primary} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMain }}>→ {rec.table}</span>
                                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 16, background: `${THEME.success}20`, color: THEME.success }}>{rec.estimatedGain}</span>
                                </div>
                                <div style={{ fontSize: 10, color: THEME.textMuted, marginBottom: 7 }}>{rec.reason}</div>
                                <div style={{ position: 'relative' }}>
                                    <pre style={{ fontSize: 9, fontFamily: 'monospace', background: `${THEME.bg}80`, borderRadius: 16, padding: '6px 28px 6px 8px', color: THEME.success, margin: 0, whiteSpace: 'pre-wrap', border: `1px solid ${THEME.grid}40` }}>{rec.suggestion}</pre>
                                    <button onClick={() => copy(rec.suggestion, `idx-${i}`)} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 2 }}>
                                        {copiedIdx === `idx-${i}` ? <Check size={10} color={THEME.success} /> : <Copy size={10} />}
                                    </button>
                                </div>
                            </div>
                        ))
                )}

                {section === 'rewrites' && rewrites.map((rw, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: 11, borderRadius: 20, background: `${THEME.warning}06`, border: `1px solid ${THEME.warning}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <Lightbulb size={12} color={THEME.warning} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: THEME.textMain }}>{rw.title}</span>
                        </div>
                        <div style={{ fontSize: 10, color: THEME.textMuted, marginBottom: 7 }}>{rw.desc}</div>
                        {rw.example && (
                            <div style={{ position: 'relative' }}>
                                <pre style={{ fontSize: 9, fontFamily: 'monospace', background: `${THEME.bg}80`, borderRadius: 16, padding: '6px 28px 6px 8px', color: THEME.primary, margin: 0, whiteSpace: 'pre-wrap', border: `1px solid ${THEME.grid}40` }}>{rw.example}</pre>
                                <button onClick={() => copy(rw.example, `rw-${i}`)} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 2 }}>
                                    {copiedIdx === `rw-${i}` ? <Check size={10} color={THEME.success} /> : <Copy size={10} />}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ActiveUsersBadge = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 16, background: `${THEME.success}12`, border: `1px solid ${THEME.success}30` }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.success, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: THEME.success, fontWeight: 600 }}>Quiet — 0 active users</span>
    </div>
);

const QueryScoreRing = ({ insights }) => {
    const dangerCount = insights.filter(i => i.type === 'danger').length;
    const warningCount = insights.filter(i => i.type === 'warning').length;
    const score = Math.max(0, 100 - dangerCount * 25 - warningCount * 10);
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';
    const gradeColor = score >= 90 ? THEME.success : score >= 75 ? THEME.successLight : score >= 60 ? THEME.warning : score >= 45 ? THEME.warningDark : THEME.danger;
    const circumference = 2 * Math.PI * 28;
    const dashOffset = circumference - (score / 100) * circumference;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '6px 12px', borderRadius: 20, background: `${gradeColor}10`, border: `1px solid ${gradeColor}30` }}>
            <svg width={52} height={52} style={{ flexShrink: 0 }}>
                <circle cx={26} cy={26} r={22} fill="none" stroke={`${gradeColor}20`} strokeWidth={4} />
                <circle cx={26} cy={26} r={22} fill="none" stroke={gradeColor} strokeWidth={4}
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 26 26)"
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <text x={26} y={31} textAnchor="middle" fill={gradeColor} fontSize={18} fontWeight={800} fontFamily="monospace">{grade}</text>
            </svg>
            <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textMain }}>Query Score</div>
                <div style={{ fontSize: 10, color: THEME.textDim }}>{score}/100 · {dangerCount} critical, {warningCount} warnings</div>
            </div>
        </div>
    );
};

const FlameGraph = ({ plan }) => {
    const nodes = [];
    const flatten = (n, depth = 0) => {
        if (!n) return;
        nodes.push({ label: `${n["Node Type"]}${n["Relation Name"] ? ` · ${n["Relation Name"]}` : ''}`, cost: n["Total Cost"] || 0, time: n["Actual Total Time"] || 0, depth, rows: n["Actual Rows"] || 0 });
        if (n.Plans) n.Plans.forEach(p => flatten(p, depth + 1));
    };
    flatten(plan?.Plan);
    const maxDepth = nodes.length > 0 ? Math.max(...nodes.map(n => n.depth), 0) : 0;
    const maxTime = nodes.length > 0 ? Math.max(...nodes.map(n => n.time), 1) : 1;
    const FLAME_COLORS = [THEME.primary, THEME.warning, THEME.danger, THEME.secondary, THEME.success, THEME.danger];

    return (
        <div>
            <div style={{ fontSize: 10, color: THEME.textDim, marginBottom: 10, display: 'flex', gap: 22, alignItems: 'center' }}>
                <span>Width = execution time proportion</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {['Root', 'Level 1', 'Level 2+'].map((l, i) => (
                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: FLAME_COLORS[i] }} />{l}
                        </span>
                    ))}
                </span>
            </div>
            {nodes.map((n, i) => (
                <div key={i} title={`${n.label}\nTime: ${formatDuration(n.time)}\nRows: ${formatRows(n.rows)}`}
                     style={{
                         marginBottom: 3, marginLeft: `${n.depth * 20}px`,
                         width: `calc(${Math.max(4, (n.time / maxTime) * 100)}% - ${n.depth * 20}px)`,
                         height: 26, borderRadius: 20,
                         background: `${FLAME_COLORS[Math.min(n.depth, FLAME_COLORS.length - 1)]}cc`,
                         display: 'flex', alignItems: 'center', padding: '0 8px',
                         cursor: 'default', overflow: 'hidden',
                         border: `1px solid ${FLAME_COLORS[Math.min(n.depth, FLAME_COLORS.length - 1)]}40`,
                         animation: `flamePop 0.4s ${i * 0.06}s both`,
                         transition: 'filter 0.15s',
                         minWidth: 30,
                     }}
                     className="opt-btn"
                >
                    <span style={{ fontSize: 9, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {n.label} · {formatDuration(n.time)}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// NEW: AI Query Rewrite Panel
// ═══════════════════════════════════════════════════════════════════════
const AIRewritePanel = ({ query, insights, onApplyRewrite }) => {
    const [loading, setLoading] = useState(false);
    const [rewrite, setRewrite] = useState(null);
    const [error, setError] = useState(null);
    const [copiedSection, setCopiedSection] = useState(null);
    const [streamedText, setStreamedText] = useState('');

    const copy = (text, key) => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopiedSection(key);
        setTimeout(() => setCopiedSection(null), 1800);
    };

    const generateRewrite = async () => {
        setLoading(true);
        setRewrite(null);
        setError(null);
        setStreamedText('');

        const issuesSummary = insights.length > 0
            ? insights.map(i => `- ${i.title}: ${i.desc}`).join('\n')
            : 'No specific issues detected, but look for general optimizations.';

        const prompt = `You are a PostgreSQL performance expert. Analyze this SQL query and the detected issues, then provide an optimized rewrite.

ORIGINAL QUERY:
${query}

DETECTED ISSUES:
${issuesSummary}

Respond ONLY with a JSON object (no markdown, no backticks) with this exact structure:
{
  "optimized_query": "the rewritten SQL query",
  "changes": [
    {"type": "improvement|warning|info", "description": "what changed and why"}
  ],
  "estimated_improvement": "e.g. 60-80% faster",
  "explanation": "2-3 sentence summary of the optimization strategy"
}`;

        try {
            const data = await postData('/api/ai/chat', {
                max_tokens: 1500,
                messages: [{ role: 'user', content: prompt }]
            });
            const raw = (Array.isArray(data?.content) ? data.content : []).map(c => c.text || '').join('') || '';

            // Strip markdown fences that Llama/Groq often adds
            const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            const jsonMatch = stripped.match(/\{[\s\S]*\}/);
            const text = jsonMatch ? jsonMatch[0] : stripped;

            // Simulate streaming effect
            let i = 0;
            const interval = setInterval(() => {
                i += 8;
                setStreamedText(text.substring(0, i));
                if (i >= text.length) {
                    clearInterval(interval);
                    try {
                        const parsed = JSON.parse(text);
                        setRewrite(parsed);
                    } catch {
                        setError('Could not parse AI response. Raw output: ' + raw.substring(0, 200));
                    }
                    setLoading(false);
                }
            }, 12);

        } catch (err) {
            const m = err.message || '';
            setError(m.includes('not configured') || m.includes('503') || m.includes('API key')
                ? 'AI rewrite is not enabled. Ask your administrator to configure the AI key in the backend settings.'
                : 'Rewrite failed. Please try again.');
            setLoading(false);
        }
    };

    const changeTypeColor = (type) => type === 'improvement' ? THEME.success : type === 'warning' ? THEME.warning : THEME.primary;
    const changeTypeIcon = (type) => type === 'improvement' ? <CheckCircle size={11} color={THEME.success} /> : type === 'warning' ? <AlertTriangle size={11} color={THEME.warning} /> : <Info size={11} color={THEME.primary} />;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0, background: `linear-gradient(135deg, ${THEME.primary}06, ${THEME.secondary || THEME.primary}04)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 20, background: `linear-gradient(135deg, ${THEME.primary}30, ${THEME.secondary || THEME.secondary}30)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wand2 size={15} color={THEME.primary} />
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain }}>Smart Query Rewriter</div>
                        <div style={{ fontSize: 10, color: THEME.textDim }}>Analyzes anti-patterns and generates an optimized query</div>
                    </div>
                    <button onClick={generateRewrite} disabled={loading || !query.trim()} className="opt-btn"
                            style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 18, border: 'none', background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary || THEME.primary})`, color: '#fff', fontSize: 11, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (loading || !query.trim()) ? 0.6 : 1, boxShadow: `0 3px 12px ${THEME.primary}40` }}>
                        {loading ? <RefreshCw size={13} style={{ animation: 'optSpin 1s linear infinite' }} /> : <Sparkles size={13} />}
                        {loading ? 'Analyzing…' : 'Rewrite with AI'}
                    </button>
                </div>
                {insights.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: THEME.textDim }}>Issues being addressed:</span>
                        {insights.slice(0, 4).map((ins, i) => (
                            <span key={i} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: ins.type === 'danger' ? `${THEME.danger}20` : `${THEME.warning}20`, color: ins.type === 'danger' ? THEME.danger : THEME.warning, fontWeight: 600 }}>{ins.title}</span>
                        ))}
                        {insights.length > 4 && <span style={{ fontSize: 9, color: THEME.textDim }}>+{insights.length - 4} more</span>}
                    </div>
                )}
            </div>

            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {/* Loading state */}
                {loading && !rewrite && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: 12, borderRadius: 20, background: `${THEME.primary}08`, border: `1px solid ${THEME.primary}20` }}>
                            <RefreshCw size={14} color={THEME.primary} style={{ animation: 'optSpin 1s linear infinite', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: THEME.primary }}>Analyzing your query…</div>
                                <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>Detecting anti-patterns, checking join strategies, evaluating index opportunities</div>
                            </div>
                        </div>
                        {streamedText && (
                            <div style={{ fontSize: 9, fontFamily: 'monospace', color: THEME.textDim, background: `${THEME.bg}80`, padding: 10, borderRadius: 18, border: `1px solid ${THEME.grid}40`, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {streamedText}<span className="ai-cursor" />
                            </div>
                        )}
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 60, borderRadius: 20 }} />
                        ))}
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div style={{ padding: 14, borderRadius: 20, background: `${THEME.danger}10`, border: `1px solid ${THEME.danger}30` }}>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 6 }}>
                            <AlertTriangle size={13} color={THEME.danger} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: THEME.danger }}>Rewrite Failed</span>
                        </div>
                        <div style={{ fontSize: 10, color: THEME.textMuted }}>{error}</div>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !rewrite && !error && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center', color: THEME.textDim }}>
                        <div style={{ width: 64, height: 64, borderRadius: 16, background: `${THEME.primary}10`, border: `1px solid ${THEME.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Wand2 size={28} color={THEME.primary} opacity={0.6} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: THEME.textMain, marginBottom: 6 }}>Smart Query Optimization</div>
                        <div style={{ fontSize: 11, lineHeight: 1.6, maxWidth: 320, color: THEME.textMuted }}>
                            Paste a query on the left, then click Rewrite. The optimizer detects anti-patterns like missing indexes, bad join strategies, and inefficient subqueries, then generates an optimized rewrite with explanations.
                        </div>
                        <div style={{ marginTop: 20, display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {['Detects anti-patterns', 'Suggests indexes', 'Rewrites joins', 'Estimates improvements'].map(f => (
                                <span key={f} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: `${THEME.primary}12`, border: `1px solid ${THEME.primary}25`, color: THEME.textDim }}>✓ {f}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                {rewrite && !loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'slideUp 0.4s ease' }}>
                        {/* Improvement estimate */}
                        <div style={{ padding: '22px 28px', borderRadius: 20, background: `linear-gradient(135deg, ${THEME.success}12, ${THEME.success}06)`, border: `1px solid ${THEME.success}30`, display: 'flex', alignItems: 'center', gap: 22 }}>
                            <TrendingUp size={18} color={THEME.success} />
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.success }}>Estimated Improvement: {rewrite.estimated_improvement}</div>
                                <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 2 }}>{rewrite.explanation}</div>
                            </div>
                        </div>

                        {/* Changes list */}
                        {rewrite.changes && rewrite.changes.length > 0 && (
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', marginBottom: 8 }}>What Changed</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {rewrite.changes.map((change, i) => (
                                        <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 18, background: `${changeTypeColor(change.type)}08`, border: `1px solid ${changeTypeColor(change.type)}20` }}>
                                            <div style={{ marginTop: 1, flexShrink: 0 }}>{changeTypeIcon(change.type)}</div>
                                            <div style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.5 }}>{change.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Side-by-side diff */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <GitCompare size={11} /> Before / After
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {[
                                    { label: 'Original', code: query, color: THEME.danger, labelBg: `${THEME.danger}15` },
                                    { label: 'Optimized', code: rewrite.optimized_query, color: THEME.success, labelBg: `${THEME.success}15` }
                                ].map((side, idx) => (
                                    <div key={idx} style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${side.color}25` }}>
                                        <div style={{ padding: '5px 10px', background: side.labelBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: side.color }}>{side.label}</span>
                                            <button onClick={() => copy(side.code, `side-${idx}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 2 }}>
                                                {copiedSection === `side-${idx}` ? <Check size={9} color={THEME.success} /> : <Copy size={9} />}
                                            </button>
                                        </div>
                                        <pre style={{ margin: 0, padding: '20px 24px', fontSize: 10, fontFamily: 'monospace', color: THEME.textMain, background: `${THEME.bg}90`, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{side.code}</pre>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Optimized query standalone with apply button */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', marginBottom: 8 }}>Optimized Query</div>
                            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: `1px solid ${THEME.success}30` }}>
                                <pre style={{ margin: 0, padding: '22px 28px', fontSize: 11, fontFamily: 'monospace', color: THEME.success, background: `${THEME.bg}95`, whiteSpace: 'pre-wrap' }}>{rewrite.optimized_query}</pre>
                                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                                    <button onClick={() => copy(rewrite.optimized_query, 'optimized')} style={{ padding: '3px 8px', borderRadius: 20, background: `${THEME.grid}80`, border: `1px solid ${THEME.glassBorder}`, cursor: 'pointer', color: THEME.textDim, fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        {copiedSection === 'optimized' ? <Check size={9} color={THEME.success} /> : <Copy size={9} />}
                                        Copy
                                    </button>
                                    <button onClick={() => onApplyRewrite(rewrite.optimized_query)} className="opt-btn" style={{ padding: '3px 10px', borderRadius: 20, background: `${THEME.primary}20`, border: `1px solid ${THEME.primary}40`, cursor: 'pointer', color: THEME.primary, fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Play size={9} fill="currentColor" /> Apply to Editor
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Re-run button */}
                        <button onClick={generateRewrite} className="opt-btn" style={{ padding: '8px', borderRadius: 18, border: `1px solid ${THEME.primary}30`, background: `${THEME.primary}08`, color: THEME.primary, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <RefreshCw size={12} /> Generate Another Variant
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// NEW: Service Cost Attribution Panel
// ═══════════════════════════════════════════════════════════════════════
const ServiceAttributionPanel = ({ serviceAttribution = [] }) => {
    const [sortBy, setSortBy] = useState('cost_share');
    const [view, setView] = useState('chart');
    const safeAttribution = Array.isArray(serviceAttribution) ? serviceAttribution : [];
    const sorted = [...safeAttribution].sort((a, b) => b[sortBy] - a[sortBy]);
    const totalTime = safeAttribution.reduce((s, r) => s + (r?.total_time_ms || 0), 0);
    const maxCostShare = sorted.length > 0 ? Math.max(...sorted.map(s => s.cost_share || 0)) : 0;

    const teamColors = { Platform: THEME.primary, Commerce: THEME.warning, Data: THEME.secondary, Growth: THEME.success, Search: THEME.danger };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Summary row */}
            <div style={{ padding: '16px 22px', display: 'flex', gap: 18, borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                {[
                    { label: 'Services Tracked', value: safeAttribution.length, color: THEME.textMain },
                    { label: 'Total DB Time', value: formatDuration(totalTime), color: THEME.primary },
                    { label: 'Slowest Avg (ms)', value: formatDuration(safeAttribution.length > 0 ? Math.max(...safeAttribution.map(s => s.avg_time || 0)) : 0), color: THEME.danger },
                    { label: 'Top Offender', value: sorted[0]?.service || '—', color: THEME.warning },
                ].map((k, i) => (
                    <div key={i} className="opt-card" style={{ flex: 1, padding: '20px 24px', borderRadius: 18 }}>
                        <div style={{ fontSize: 9, color: THEME.textDim,  marginBottom: 2 }}>{k.label}</div>
                        <div style={{ fontSize: i === 3 ? 12 : 18, fontWeight: 800, color: k.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${THEME.grid}`, display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: THEME.textDim, fontWeight: 700 }}>Sort:</span>
                {[
                    { key: 'cost_share', label: '% DB Cost' },
                    { key: 'total_time_ms', label: 'Total Time' },
                    { key: 'avg_time', label: 'Avg Time' },
                    { key: 'queries', label: 'Query Count' },
                ].map(s => (
                    <button key={s.key} onClick={() => setSortBy(s.key)} style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${sortBy === s.key ? THEME.primary : THEME.grid}`, background: sortBy === s.key ? `${THEME.primary}20` : 'transparent', color: sortBy === s.key ? THEME.primary : THEME.textMuted, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{s.label}</button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {['chart', 'table'].map(v => (
                        <button key={v} onClick={() => setView(v)} style={{ padding: '3px 9px', borderRadius: 20, border: `1px solid ${view === v ? THEME.primary : THEME.grid}`, background: view === v ? `${THEME.primary}20` : 'transparent', color: view === v ? THEME.primary : THEME.textMuted, fontSize: 10, cursor: 'pointer', textTransform: 'capitalize' }}>{v}</button>
                    ))}
                </div>
            </div>

            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {view === 'chart' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {/* Stacked distribution bar */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  marginBottom: 8, letterSpacing: '0.02em' }}>Database Time Distribution by Service</div>
                            <div style={{ height: 32, borderRadius: 18, overflow: 'hidden', display: 'flex' }}>
                                {sorted.map((svc, i) => {
                                    const colors = [THEME.primary, THEME.warning, THEME.secondary, THEME.success, THEME.danger, THEME.danger];
                                    return (
                                        <div key={svc.service} title={`${svc.service}: ${svc.cost_share.toFixed(1)}%`}
                                             style={{ flex: svc.cost_share, background: colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'flex 0.5s ease' }}>
                                            {svc.cost_share > 8 && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{svc.service}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap' }}>
                                {sorted.map((svc, i) => {
                                    const colors = [THEME.primary, THEME.warning, THEME.secondary, THEME.success, THEME.danger, THEME.danger];
                                    return (
                                        <span key={svc.service} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: THEME.textDim }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                                            {svc.service} <span style={{ color: colors[i % colors.length], fontWeight: 700 }}>{svc.cost_share.toFixed(1)}%</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Per-service cards */}
                        {sorted.map((svc, i) => {
                            const colors = [THEME.primary, THEME.warning, THEME.secondary, THEME.success, THEME.danger, THEME.danger];
                            const c = colors[i % colors.length];
                            const teamColor = teamColors[svc.team] || THEME.textDim;
                            return (
                                <div key={svc.service} className="opt-card" style={{ padding: '18px 22px', borderRadius: 16, borderLeft: `4px solid ${c}`, animation: `optFadeIn 0.3s ${i * 0.06}s both` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                                            <div style={{ width: 34, height: 34, borderRadius: 20, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Building2 size={15} color={c} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMain, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {svc.service}
                                                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: `${teamColor}18`, color: teamColor, fontWeight: 700 }}>{svc.team}</span>
                                                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: `${THEME.grid}60`, color: THEME.textDim }}>{svc.db}</span>
                                                </div>
                                                <div style={{ fontSize: 10, color: THEME.textDim, marginTop: 2 }}>Hot table: <code style={{ color: THEME.primary, fontFamily: 'monospace' }}>{svc.top_table}</code></div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: metricValue(c) }}>{svc.cost_share.toFixed(1)}%</div>
                                            <div style={{ fontSize: 9, color: THEME.textDim }}>of DB load</div>
                                        </div>
                                    </div>

                                    {/* Cost share bar */}
                                    <div style={{ height: 6, background: `${THEME.grid}30`, borderRadius: 16, overflow: 'hidden', marginBottom: 10 }}>
                                        <div style={{ width: `${(svc.cost_share / maxCostShare) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${c}, ${c}99)`, borderRadius: 16, transition: 'width 0.8s ease' }} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                                        {[
                                            { label: 'Queries', value: svc.queries.toLocaleString(), color: THEME.textMain },
                                            { label: 'Avg Time', value: formatDuration(svc.avg_time), color: svc.avg_time > 1000 ? THEME.danger : svc.avg_time > 200 ? THEME.warning : THEME.success },
                                            { label: 'P99 Time', value: formatDuration(svc.p99), color: svc.p99 > 5000 ? THEME.danger : THEME.warning },
                                            { label: 'Total DB', value: formatDuration(svc.total_time_ms), color: THEME.textMuted },
                                        ].map((stat, j) => (
                                            <div key={j} style={{ textAlign: 'center', padding: '6px 8px', borderRadius: 18, background: `${THEME.grid}20` }}>
                                                <div style={{ fontSize: 8, color: THEME.textDim,  marginBottom: 3 }}>{stat.label}</div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Warning for high avg time */}
                                    {svc.avg_time > 1000 && (
                                        <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 16, background: `${THEME.danger}10`, border: `1px solid ${THEME.danger}25`, display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <AlertTriangle size={11} color={THEME.danger} />
                                            <span style={{ fontSize: 10, color: THEME.textMuted }}>Average query time exceeds 1s — investigate slow query log for this service</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                        <tr style={{ borderBottom: `1px solid ${THEME.grid}` }}>
                            {['Service', 'Team', 'DB', 'Queries', 'Avg Time', 'P99 Time', 'Total DB Time', 'Cost Share', 'Hot Table'].map(h => (
                                <th key={h} style={{ padding: '20px 24px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {sorted.map((svc, i) => (
                            <tr key={i} className="opt-row-hover" style={{ borderBottom: `1px solid ${THEME.grid}30` }}>
                                <td style={{ padding: '9px 12px', color: THEME.textMain, fontWeight: 600 }}>{svc.service}</td>
                                <td style={{ padding: '9px 12px', color: teamColors[svc.team] || THEME.textMuted }}>{svc.team}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textDim, fontSize: 10 }}>{svc.db}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{svc.queries.toLocaleString()}</td>
                                <td style={{ padding: '9px 12px', color: svc.avg_time > 1000 ? THEME.danger : svc.avg_time > 200 ? THEME.warning : THEME.success, fontWeight: 600 }}>{formatDuration(svc.avg_time)}</td>
                                <td style={{ padding: '9px 12px', color: svc.p99 > 5000 ? THEME.danger : THEME.warning }}>{formatDuration(svc.p99)}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{formatDuration(svc.total_time_ms)}</td>
                                <td style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 50, height: 5, background: `${THEME.grid}40`, borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${(svc.cost_share / maxCostShare) * 100}%`, height: '100%', background: THEME.primary }} />
                                        </div>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: THEME.primary }}>{svc.cost_share.toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td style={{ padding: '9px 12px', color: THEME.primary, fontFamily: 'monospace', fontSize: 10 }}>{svc.top_table}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid ${THEME.grid}`, fontSize: 10, color: THEME.textDim, flexShrink: 0 }}>
                Data from <code style={{ color: THEME.primary }}>pg_stat_statements</code> joined with <code style={{ color: THEME.primary }}>application_name</code> connection param. Services must set <code style={{ color: THEME.primary }}>SET application_name = 'service-name'</code>.
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// NEW: Parameterization Advisor Panel
// ═══════════════════════════════════════════════════════════════════════
const ParameterizationAdvisorPanel = ({ paramIssues = [] }) => {
    const [selected, setSelected] = useState(null);
    const [copiedIdx, setCopiedIdx] = useState(null);
    const copy = (text, key) => { navigator.clipboard?.writeText(text).catch(() => {}); setCopiedIdx(key); setTimeout(() => setCopiedIdx(null), 1800); };

    const riskColor = (r) => r === 'CRITICAL' ? THEME.danger : r === 'HIGH' ? THEME.warningDark : THEME.warning;
    const riskIcon = (r) => r === 'CRITICAL' ? <AlertOctagon size={12} color={THEME.danger} /> : r === 'HIGH' ? <ShieldAlert size={12} color={THEME.warningDark} /> : <AlertTriangle size={12} color={THEME.warning} />;

    const safeParamIssues = Array.isArray(paramIssues) ? paramIssues : [];
    const totalCalls = safeParamIssues.reduce((s, q) => s + (q?.calls || 0), 0);
    const criticalCount = safeParamIssues.filter(q => q?.risk === 'CRITICAL').length;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Summary */}
            <div style={{ padding: '16px 22px', display: 'flex', gap: 18, borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                {[
                    { label: 'Unparameterized', value: safeParamIssues.length, color: THEME.warning, icon: AlertTriangle },
                    { label: 'Critical (Security)', value: criticalCount, color: THEME.danger, icon: ShieldAlert },
                    { label: 'Affected Calls', value: (totalCalls || 0).toLocaleString(), color: THEME.textMain, icon: Database },
                    { label: 'Cache Waste Avg', value: '89%', color: THEME.danger, icon: Gauge },
                ].map((k, i) => (
                    <div key={i} className="opt-card" style={{ flex: 1, padding: '20px 24px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 22 }}>
                        <k.icon size={16} color={k.color} />
                        <div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>{k.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Context banner */}
            <div style={{ padding: '16px 22px', background: `${THEME.danger}06`, borderBottom: `1px solid ${THEME.danger}20`, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <ShieldAlert size={14} color={THEME.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.6 }}>
                        <strong style={{ color: THEME.textMain }}>Why this matters:</strong> String literals embedded in queries bypass PostgreSQL's plan cache (every unique value = a new plan), waste memory in <code style={{ color: THEME.primary, fontFamily: 'monospace' }}>pg_stat_statements</code>, and expose data to SQL injection. Parameterized queries with <code style={{ color: THEME.primary, fontFamily: 'monospace' }}>$1, $2…</code> fix all of this.
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
                {/* Query list */}
                <div className="opt-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
                    {safeParamIssues.map((q, i) => (
                        <div key={q.id}
                             onClick={() => setSelected(selected === q.id ? null : q.id)}
                             className="opt-row-hover"
                             style={{ padding: '18px 22px', borderBottom: `1px solid ${THEME.grid}25`, cursor: 'pointer', borderLeft: selected === q.id ? `3px solid ${THEME.primary}` : '3px solid transparent', background: selected === q.id ? `${THEME.primary}05` : q.risk === 'CRITICAL' ? `${THEME.danger}04` : 'transparent', animation: `optFadeIn 0.3s ${i * 0.05}s both` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                                        {riskIcon(q.risk)}
                                        <span style={{ fontSize: 10, fontWeight: 700, color: riskColor(q.risk) }}>{q.risk}</span>
                                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 16, background: `${riskColor(q.risk)}15`, color: riskColor(q.risk) }}>{q.issue}</span>
                                        <span style={{ fontSize: 9, color: THEME.textDim }}>{q.calls.toLocaleString()} calls/day</span>
                                    </div>
                                    <div style={{ fontSize: 10, color: THEME.textMain, fontFamily: 'monospace', background: `${THEME.bg}80`, padding: '6px 8px', borderRadius: 16, border: `1px solid ${THEME.grid}40`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {q.query}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: THEME.danger }}>{q.plan_cache_waste}</div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>cache waste</div>
                                </div>
                            </div>
                            <div style={{ height: 5, background: `${THEME.grid}30`, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: q.plan_cache_waste, height: '100%', background: `linear-gradient(90deg, ${THEME.danger}, ${THEME.warning})`, borderRadius: 2 }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Detail panel */}
                {selected ? (() => {
                    const q = safeParamIssues.find(p => p.id === selected);
                    if (!q) return null;
                    return (
                        <div className="opt-scroll" style={{ width: 380, borderLeft: `1px solid ${THEME.grid}`, overflowY: 'auto', padding: 16, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
                                {riskIcon(q.risk)}
                                <span style={{ fontSize: 12, fontWeight: 700, color: riskColor(q.risk) }}>{q.issue}</span>
                                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: `${riskColor(q.risk)}20`, color: riskColor(q.risk), fontWeight: 700 }}>{q.risk}</span>
                            </div>

                            <div style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.6, marginBottom: 14, padding: '8px 10px', borderRadius: 18, background: `${riskColor(q.risk)}08`, border: `1px solid ${riskColor(q.risk)}20` }}>
                                {q.description}
                            </div>

                            {/* Detected literals */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  marginBottom: 6 }}>Detected Literals</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {q.literals.map((lit, i) => (
                                        <span key={i} style={{ padding: '2px 8px', borderRadius: 20, background: `${THEME.danger}18`, border: `1px solid ${THEME.danger}30`, fontSize: 10, fontFamily: 'monospace', color: THEME.danger, fontWeight: 600 }}>{lit}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Before / After */}
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  marginBottom: 6 }}>Before → After</div>
                                {[
                                    { label: 'Unparameterized', code: q.query, color: THEME.danger, badge: '❌' },
                                    { label: 'Parameterized', code: q.parameterized, color: THEME.success, badge: '✓' },
                                ].map((side, idx) => (
                                    <div key={idx} style={{ marginBottom: 8, borderRadius: 18, overflow: 'hidden', border: `1px solid ${side.color}25` }}>
                                        <div style={{ padding: '4px 10px', background: `${side.color}12`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: side.color }}>{side.badge} {side.label}</span>
                                        </div>
                                        <pre style={{ margin: 0, padding: '8px 10px', fontSize: 10, fontFamily: 'monospace', color: THEME.textMain, background: `${THEME.bg}90`, whiteSpace: 'pre-wrap' }}>{side.code}</pre>
                                    </div>
                                ))}
                            </div>

                            {/* Fix */}
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  marginBottom: 6 }}>Recommended Fix</div>
                                <div style={{ position: 'relative' }}>
                                    <pre style={{ margin: 0, padding: '10px 32px 10px 10px', fontSize: 10, fontFamily: 'monospace', color: THEME.success, background: `${THEME.bg}95`, borderRadius: 18, border: `1px solid ${THEME.success}30`, whiteSpace: 'pre-wrap' }}>{q.fix}</pre>
                                    <button onClick={() => copy(q.fix, `param-fix-${q.id}`)} style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 2 }}>
                                        {copiedIdx === `param-fix-${q.id}` ? <Check size={10} color={THEME.success} /> : <Copy size={10} />}
                                    </button>
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {[
                                    { label: 'Daily Calls', value: q.calls.toLocaleString(), color: THEME.textMain },
                                    { label: 'Plan Cache Waste', value: q.plan_cache_waste, color: THEME.danger },
                                ].map((s, i) => (
                                    <div key={i} style={{ padding: '8px 10px', borderRadius: 18, background: `${THEME.grid}25`, textAlign: 'center' }}>
                                        <div style={{ fontSize: 9, color: THEME.textDim,  marginBottom: 2 }}>{s.label}</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })() : (
                    <div style={{ width: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, color: THEME.textDim }}>
                        <Microscope size={28} opacity={0.3} />
                        <div style={{ fontSize: 11 }}>Select a query to see details</div>
                    </div>
                )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid ${THEME.grid}`, fontSize: 10, color: THEME.textDim, flexShrink: 0 }}>
                Queries detected via <code style={{ color: THEME.primary }}>pg_stat_statements</code> pattern analysis. Literals are highlighted in <span style={{ color: THEME.danger }}>red</span>. Use prepared statements or ORMs with parameterized queries.
            </div>
        </div>
    );
};

// Slow Query Log Panel
const SlowQueryPanel = ({ onLoadQuery, slowQueries = [] }) => {
    const [sortBy, setSortBy] = useState('mean_time');
    const [selectedId, setSelectedId] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [tagFilter, setTagFilter] = useState(null);

    const safeSlowQueries = Array.isArray(slowQueries) ? slowQueries : [];
    const allTags = [...new Set(safeSlowQueries.flatMap(q => q?.tags || []))];
    const filtered = safeSlowQueries
        .filter(q => !searchText || (q?.query || '').toLowerCase().includes(searchText.toLowerCase()))
        .filter(q => !tagFilter || (q?.tags || []).includes(tagFilter))
        .sort((a, b) => (b?.[sortBy] || 0) - (a?.[sortBy] || 0));

    const selected = filtered.find(q => q.id === selectedId);
    const tagColors = { 'no-index': THEME.danger, 'seq-scan': THEME.warning, 'aggregation': THEME.primary, 'hot-table': THEME.secondary, 'wide-select': THEME.warning, 'bulk-delete': THEME.danger, 'locks': THEME.danger };

    return (
        <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${THEME.grid}`, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${THEME.grid}`, display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 120 }}>
                        <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: THEME.textDim }} />
                        <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search queries…"
                               style={{ width: '100%', background: `${THEME.surface}`, border: `1px solid ${THEME.glassBorder}`, borderRadius: 16, padding: '5px 8px 5px 26px', fontSize: 10, color: THEME.textMain, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: 16, padding: '4px 8px', fontSize: 10, color: THEME.textMain, cursor: 'pointer' }}>
                        <option value="mean_time">Sort: Mean Time</option>
                        <option value="p99_time">Sort: P99 Time</option>
                        <option value="total_time">Sort: Total Time</option>
                        <option value="calls">Sort: Calls</option>
                    </select>
                </div>
                <div style={{ padding: '6px 12px', borderBottom: `1px solid ${THEME.grid}`, display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
                    <button onClick={() => setTagFilter(null)} className="tag-pill" style={{ background: !tagFilter ? `${THEME.primary}25` : `${THEME.grid}40`, color: !tagFilter ? THEME.primary : THEME.textDim, border: `1px solid ${!tagFilter ? THEME.primary : 'transparent'}` }}>All</button>
                    {allTags.map(tag => (
                        <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} className="tag-pill"
                                style={{ background: tagFilter === tag ? `${tagColors[tag] || THEME.primary}30` : `${THEME.grid}30`, color: tagFilter === tag ? (tagColors[tag] || THEME.primary) : THEME.textDim, border: `1px solid ${tagFilter === tag ? (tagColors[tag] || THEME.primary) : 'transparent'}` }}>
                            {tag}
                        </button>
                    ))}
                </div>

                <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.map((q, i) => {
                        const meanTime = q?.mean_time || 0;
                        const maxVal = q?.p99_time || meanTime || 1;
                        return (
                        <div key={q?.id} onClick={() => setSelectedId(q?.id === selectedId ? null : q?.id)}
                             className="opt-row-hover"
                             style={{ padding: '20px 24px', borderBottom: `1px solid ${THEME.grid}25`, cursor: 'pointer', background: selectedId === q?.id ? `${THEME.primary}08` : 'transparent', borderLeft: selectedId === q?.id ? `3px solid ${THEME.primary}` : '3px solid transparent', animation: `optFadeIn 0.3s ${i * 0.04}s both` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 10, color: THEME.textMain, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{q?.query || '—'}</div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {(q?.tags || []).map(tag => (
                                            <span key={tag} className="tag-pill" style={{ background: `${tagColors[tag] || THEME.primary}20`, color: tagColors[tag] || THEME.primary }}>{tag}</span>
                                        ))}
                                        <span style={{ fontSize: 9, color: THEME.textDim }}>{q?.db || '—'}</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: meanTime > 500 ? THEME.danger : meanTime > 100 ? THEME.warning : THEME.success }}>{formatDuration(meanTime)}</div>
                                    <div style={{ fontSize: 9, color: THEME.textDim }}>{((q?.calls) || 0).toLocaleString()} calls</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 3, marginTop: 6, alignItems: 'flex-end', height: 16 }}>
                                {[(q?.mean_time || 0), (q?.p95_time || 0), (q?.p99_time || 0)].map((val, j) => {
                                    const h = Math.max(3, (val / maxVal) * 16);
                                    return <div key={j} style={{ width: 6, height: h, borderRadius: 1, background: j === 0 ? THEME.success : j === 1 ? THEME.warning : THEME.danger, flexShrink: 0 }} />;
                                })}
                                <span style={{ fontSize: 8, color: THEME.textDim, marginLeft: 4 }}>p50/p95/p99</span>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>

            {selected ? (
                <div className="opt-scroll" style={{ width: 340, overflowY: 'auto', padding: 16, flexShrink: 0 }}>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textDim,  marginBottom: 8, letterSpacing: '0.02em' }}>Query Text</div>
                        <pre style={{ fontSize: 10, fontFamily: 'monospace', color: THEME.textMain, background: `${THEME.bg}80`, borderRadius: 18, padding: 10, whiteSpace: 'pre-wrap', border: `1px solid ${THEME.grid}40`, margin: 0 }}>{selected?.query || '—'}</pre>
                        <button onClick={() => onLoadQuery(selected?.query || '')} className="opt-btn" style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 16, border: `1px solid ${THEME.primary}40`, background: `${THEME.primary}15`, color: THEME.primary, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Load into Editor & Analyze →
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 12 }}>
                        {[
                            { label: 'Mean Time', value: formatDuration(selected?.mean_time || 0), color: THEME.primary },
                            { label: 'P95 Time', value: formatDuration(selected?.p95_time || 0), color: THEME.warning },
                            { label: 'P99 Time', value: formatDuration(selected?.p99_time || 0), color: THEME.danger },
                            { label: 'Total Time', value: formatDuration(selected?.total_time || 0), color: THEME.textDim },
                            { label: 'Calls', value: ((selected?.calls) || 0).toLocaleString(), color: THEME.textMain },
                            { label: 'Avg Rows', value: formatRows(selected?.rows || 0), color: THEME.textMuted },
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '8px 10px', borderRadius: 18, background: `${THEME.grid}25`, textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: THEME.textDim,  marginBottom: 2 }}>{s.label}</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim,  marginBottom: 8 }}>Time Distribution</div>
                        <div style={{ position: 'relative', height: 24, borderRadius: 20, overflow: 'hidden', background: `${THEME.grid}30` }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${((selected?.mean_time || 0) / (selected?.p99_time || 1)) * 100}%`, background: THEME.success, borderRadius: 16 }} />
                            <div style={{ position: 'absolute', left: `${((selected?.mean_time || 0) / (selected?.p99_time || 1)) * 100}%`, top: 0, bottom: 0, width: `${(((selected?.p95_time || 0) - (selected?.mean_time || 0)) / (selected?.p99_time || 1)) * 100}%`, background: THEME.warning }} />
                            <div style={{ position: 'absolute', left: `${((selected?.p95_time || 0) / (selected?.p99_time || 1)) * 100}%`, top: 0, bottom: 0, right: 0, background: THEME.danger, borderRadius: '0 4px 4px 0' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: THEME.textDim, marginTop: 4 }}>
                            <span style={{ color: THEME.success }}>p50: {formatDuration(selected?.mean_time || 0)}</span>
                            <span style={{ color: THEME.warning }}>p95: {formatDuration(selected?.p95_time || 0)}</span>
                            <span style={{ color: THEME.danger }}>p99: {formatDuration(selected?.p99_time || 0)}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ width: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, color: THEME.textDim }}>
                    <Flame size={28} opacity={0.3} />
                    <div style={{ fontSize: 11 }}>Select a query to inspect</div>
                </div>
            )}
        </div>
    );
};

// Lock Monitor Panel
const LockMonitorPanel = ({ locks = [] }) => {
    const [selected, setSelected] = useState(null);
    const safeLocks = Array.isArray(locks) ? locks : [];
    const blockedCount = safeLocks.filter(l => l?.blocked_by).length;
    const blockingCount = safeLocks.filter(l => (l?.blocking || []).length > 0).length;
    const stateColor = (s) => s === 'active' ? THEME.success : s === 'idle in transaction' ? THEME.danger : THEME.warning;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', display: 'flex', gap: 18, borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                {[
                    { label: 'Total Locks', value: safeLocks.length, color: THEME.textMain, icon: Lock },
                    { label: 'Blocked', value: blockedCount, color: blockedCount > 0 ? THEME.danger : THEME.success, icon: XCircle },
                    { label: 'Blocking', value: blockingCount, color: blockingCount > 0 ? THEME.warning : THEME.success, icon: ShieldAlert },
                    { label: 'Idle in Txn', value: safeLocks.filter(l => l?.state === 'idle in transaction').length, color: THEME.warning, icon: Hourglass },
                ].map((k, i) => (
                    <div key={i} className="opt-card" style={{ flex: 1, padding: '20px 24px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 22 }}>
                        <k.icon size={16} color={k.color} />
                        <div>
                            <div style={{ fontSize: 9, color: THEME.textDim }}>{k.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {blockedCount > 0 && (
                <div style={{ padding: '18px 22px', borderBottom: `1px solid ${THEME.grid}`, background: `${THEME.danger}05`, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: THEME.danger,  marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Siren size={12} /> Lock Chain Detected
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        {safeLocks.filter(l => (l?.blocking || []).length > 0).map(blocker => (
                            <React.Fragment key={blocker?.pid}>
                                <div style={{ padding: '4px 10px', borderRadius: 18, background: `${THEME.danger}20`, border: `1px solid ${THEME.danger}40`, fontSize: 10, color: THEME.danger, fontFamily: 'monospace', fontWeight: 700 }}>
                                    PID {blocker?.pid || '?'}
                                    <span style={{ fontSize: 8, color: THEME.textDim, fontWeight: 400, marginLeft: 4 }}>blocking</span>
                                </div>
                                <ArrowRight size={14} color={THEME.danger} />
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {((blocker?.blocking) || []).map(pid => (
                                        <div key={pid} style={{ padding: '4px 10px', borderRadius: 18, background: `${THEME.warning}20`, border: `1px solid ${THEME.warning}40`, fontSize: 10, color: THEME.warning, fontFamily: 'monospace', fontWeight: 700 }}>
                                            PID {pid}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginLeft: 8, fontSize: 9, color: THEME.textDim }}>
                                    → <code style={{ color: THEME.textMuted, fontFamily: 'monospace' }}>SELECT pg_cancel_backend({blocker?.pid || '?'});</code>
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}

            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.grid}` }}>
                        {['PID', 'State', 'Mode', 'Relation', 'Granted', 'Duration', 'Blocked By', 'Query'].map(h => (
                            <th key={h} style={{ padding: '20px 24px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {safeLocks.map((lock, i) => (
                        <tr key={i} onClick={() => setSelected(selected === lock?.pid ? null : lock?.pid)}
                            className="opt-row-hover"
                            style={{ borderBottom: `1px solid ${THEME.grid}25`, cursor: 'pointer', background: selected === lock?.pid ? `${THEME.primary}08` : lock?.blocked_by ? `${THEME.danger}05` : 'transparent' }}>
                            <td style={{ padding: '9px 12px', color: THEME.primary, fontFamily: 'monospace', fontWeight: 700 }}>{lock?.pid || '?'}</td>
                            <td style={{ padding: '9px 12px' }}><span style={{ padding: '2px 7px', borderRadius: 20, background: `${stateColor(lock?.state)}18`, color: stateColor(lock?.state), fontSize: 9, fontWeight: 700 }}>{lock?.state || '?'}</span></td>
                            <td style={{ padding: '9px 12px', fontSize: 9, color: THEME.textMuted, fontFamily: 'monospace' }}>{(lock?.mode || '').replace('Lock', '')}</td>
                            <td style={{ padding: '9px 12px', color: THEME.textMain, fontFamily: 'monospace' }}>{lock?.relation || '?'}</td>
                            <td style={{ padding: '9px 12px' }}>{lock?.granted ? <CheckCircle size={13} color={THEME.success} /> : <XCircle size={13} color={THEME.danger} />}</td>
                            <td style={{ padding: '9px 12px', color: (lock?.duration || 0) > 10 ? THEME.danger : THEME.textMuted }}>{((lock?.duration) || 0).toFixed(1)}s</td>
                            <td style={{ padding: '9px 12px', color: THEME.warning, fontFamily: 'monospace' }}>{lock?.blocked_by ? `PID ${lock.blocked_by}` : '—'}</td>
                            <td style={{ padding: '9px 12px', color: THEME.textMuted, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, fontFamily: 'monospace' }}>{lock?.query || '—'}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${THEME.grid}`, fontSize: 10, color: THEME.textDim, flexShrink: 0, display: 'flex', gap: 22 }}>
                <span>Tip: Long-running "idle in transaction" sessions hold locks indefinitely.</span>
                <span style={{ marginLeft: 'auto', color: THEME.primary, fontFamily: 'monospace', cursor: 'pointer' }}>SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';</span>
            </div>
        </div>
    );
};

// Maintenance Panel
const MaintenancePanel = ({ maintenance = [] }) => {
    const [running, setRunning] = useState({});
    const safeMaintenance = Array.isArray(maintenance) ? maintenance : [];
    const triggerVacuum = (table) => {
        setRunning(r => ({ ...r, [table]: true }));
        setTimeout(() => setRunning(r => { const n = { ...r }; delete n[table]; return n; }), 2400);
    };

    const urgency = (row) => {
        if ((row?.bloat_pct || 0) > 30 || (row?.dead_tuples || 0) > (row?.live_tuples || 1) * 0.1) return 'critical';
        if ((row?.bloat_pct || 0) > 15 || (row?.dead_tuples || 0) > (row?.live_tuples || 1) * 0.05) return 'warning';
        return 'ok';
    };
    const urgencyColor = (u) => u === 'critical' ? THEME.danger : u === 'warning' ? THEME.warning : THEME.success;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', display: 'flex', gap: 18, borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                {[
                    { label: 'Tables Monitored', value: safeMaintenance.length, color: THEME.textMain },
                    { label: 'Need Vacuum', value: safeMaintenance.filter(t => urgency(t) !== 'ok').length, color: THEME.warning },
                    { label: 'Critical Bloat', value: safeMaintenance.filter(t => urgency(t) === 'critical').length, color: THEME.danger },
                    { label: 'Total Dead Tuples', value: formatRows(safeMaintenance.reduce((s, t) => s + (t?.dead_tuples || 0), 0)), color: THEME.textMuted },
                ].map((k, i) => (
                    <div key={i} className="opt-card" style={{ flex: 1, padding: '20px 24px', borderRadius: 18 }}>
                        <div style={{ fontSize: 9, color: THEME.textDim,  marginBottom: 2 }}>{k.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.grid}` }}>
                        {['Table', 'Size', 'Live Tuples', 'Dead Tuples', 'Bloat %', 'Last Vacuum', 'Last Analyze', 'Vacuums', 'Status', 'Action'].map(h => (
                            <th key={h} style={{ padding: '20px 24px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {safeMaintenance.map((t, i) => {
                        const u = urgency(t);
                        const uc = urgencyColor(u);
                        const isRunning = running[t?.table];
                        return (
                            <tr key={i} className="opt-row-hover" style={{ borderBottom: `1px solid ${THEME.grid}25`, background: u === 'critical' ? `${THEME.danger}04` : 'transparent' }}>
                                <td style={{ padding: '9px 12px', color: THEME.textMain, fontFamily: 'monospace', fontWeight: 600 }}>{t?.table || '—'}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{t?.size || '—'}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{formatRows(t?.live_tuples || 0)}</td>
                                <td style={{ padding: '9px 12px', color: (t?.dead_tuples || 0) > (t?.live_tuples || 1) * 0.05 ? THEME.warning : THEME.textMuted }}>
                                    {formatRows(t?.dead_tuples || 0)}
                                    {(t?.dead_tuples || 0) > (t?.live_tuples || 1) * 0.05 && <span style={{ marginLeft: 4 }}>⚠</span>}
                                </td>
                                <td style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 40, height: 5, background: `${THEME.grid}40`, borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, t?.bloat_pct || 0)}%`, height: '100%', background: uc }} />
                                        </div>
                                        <span style={{ fontSize: 9, color: uc, fontWeight: 700 }}>{(t?.bloat_pct || 0).toFixed(1)}%</span>
                                    </div>
                                </td>
                                <td style={{ padding: '9px 12px', color: (t?.last_vacuum || '').includes('d') ? THEME.danger : THEME.textMuted, fontSize: 10 }}>{t?.last_vacuum || 'never'}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted, fontSize: 10 }}>{t?.last_analyze || 'never'}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{t?.vacuum_count || 0}</td>
                                <td style={{ padding: '9px 12px' }}>
                                    <span style={{ padding: '2px 7px', borderRadius: 20, background: `${uc}18`, color: uc, fontSize: 9, fontWeight: 700 }}>{u}</span>
                                </td>
                                <td style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => triggerVacuum(t?.table)} disabled={isRunning}
                                                style={{ fontSize: 9, padding: '2px 8px', borderRadius: 16, background: isRunning ? `${THEME.primary}10` : `${THEME.primary}15`, color: isRunning ? THEME.textDim : THEME.primary, border: `1px solid ${THEME.primary}30`, cursor: isRunning ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                            {isRunning ? <><RefreshCw size={8} style={{ animation: 'optSpin 1s linear infinite' }} /> Running…</> : 'VACUUM'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${THEME.grid}`, fontSize: 10, color: THEME.textDim, flexShrink: 0 }}>
                Tip: Run <code style={{ color: THEME.primary }}>VACUUM ANALYZE</code> on tables with &gt;10% bloat.
            </div>
        </div>
    );
};

// Config Advisor Panel
const ConfigAdvisorPanel = ({ pgConfig = [] }) => {
    const [category, setCategory] = useState('All');
    const safePgConfig = Array.isArray(pgConfig) ? pgConfig : [];
    const categories = ['All', ...new Set(safePgConfig.map(c => c?.category).filter(Boolean))];
    const filtered = category === 'All' ? safePgConfig : safePgConfig.filter(c => c?.category === category);
    const [copiedKey, setCopiedKey] = useState(null);
    const copy = (text, key) => { navigator.clipboard?.writeText(text).catch(() => {}); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1800); };
    const impactColor = (i) => i === 'HIGH' ? THEME.danger : i === 'MEDIUM' ? THEME.warning : THEME.success;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${THEME.grid}`, display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                <SlidersHorizontal size={13} color={THEME.primary} />
                <span style={{ fontSize: 10, fontWeight: 700, color: THEME.textDim, marginRight: 6 }}>Category:</span>
                {categories.map(c => (
                    <button key={c} onClick={() => setCategory(c)} style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${category === c ? THEME.primary : THEME.grid}`, background: category === c ? `${THEME.primary}20` : 'transparent', color: category === c ? THEME.primary : THEME.textMuted, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{c}</button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: THEME.textDim }}>
                    {filtered.filter(c => c.current !== c.recommended).length} settings need tuning
                </span>
            </div>

            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    {filtered.map((cfg, i) => {
                        const needsChange = (cfg?.current || '') !== (cfg?.recommended || '');
                        const setCmd = `ALTER SYSTEM SET ${cfg?.name || '?'} = '${cfg?.recommended || '?'}';`;
                        return (
                            <div key={i} className="opt-card" style={{ padding: '18px 22px', borderRadius: 20, borderLeft: `4px solid ${needsChange ? impactColor(cfg?.impact || 'LOW') : THEME.success}`, animation: `optFadeIn 0.3s ${i * 0.04}s both` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 4 }}>
                                            <code style={{ fontSize: 12, fontWeight: 700, color: THEME.primary, fontFamily: 'monospace' }}>{cfg?.name || '?'}</code>
                                            <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 16, background: `${impactColor(cfg?.impact || 'LOW')}18`, color: impactColor(cfg?.impact || 'LOW'), fontWeight: 700 }}>{cfg?.impact || 'UNKNOWN'}</span>
                                            <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 16, background: `${THEME.grid}60`, color: THEME.textDim, fontWeight: 600 }}>{cfg?.category || '?'}</span>
                                        </div>
                                        <div style={{ fontSize: 10, color: THEME.textMuted, lineHeight: 1.5, marginBottom: 8 }}>{cfg?.desc || '—'}</div>
                                        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <span style={{ fontSize: 9, color: THEME.textDim }}>Current:</span>
                                                <code style={{ fontSize: 11, fontWeight: 700, color: needsChange ? THEME.danger : THEME.success, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 16, background: needsChange ? `${THEME.danger}15` : `${THEME.success}15` }}>{cfg?.current || '?'}</code>
                                            </div>
                                            {needsChange && (
                                                <>
                                                    <ArrowRight size={12} color={THEME.textDim} />
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <span style={{ fontSize: 9, color: THEME.textDim }}>Recommended:</span>
                                                        <code style={{ fontSize: 11, fontWeight: 700, color: THEME.success, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 16, background: `${THEME.success}15` }}>{cfg?.recommended || '?'}</code>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {needsChange && (
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{ fontSize: 9, background: `${THEME.bg}90`, border: `1px solid ${THEME.grid}40`, borderRadius: 16, padding: '5px 28px 5px 8px', fontFamily: 'monospace', color: THEME.success, whiteSpace: 'nowrap' }}>
                                                {setCmd}
                                            </div>
                                            <button onClick={() => copy(setCmd, cfg.name)} style={{ position: 'absolute', top: '50%', right: 5, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 2 }}>
                                                {copiedKey === cfg.name ? <Check size={10} color={THEME.success} /> : <Copy size={10} />}
                                            </button>
                                        </div>
                                    )}
                                    {!needsChange && <CheckCircle size={16} color={THEME.success} style={{ flexShrink: 0 }} />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${THEME.grid}`, fontSize: 10, color: THEME.textDim, flexShrink: 0 }}>
                After changes: <code style={{ color: THEME.primary }}>SELECT pg_reload_conf();</code>
            </div>
        </div>
    );
};

// Index Advisor
const IndexAdvisorPanel = ({ indexes = [] }) => {
    const [filter, setFilter] = useState('all');
    const safeIndexes = Array.isArray(indexes) ? indexes : [];
    const filtered = filter === 'all' ? safeIndexes : safeIndexes.filter(i => i?.status === filter);
    const statusColor = (s) => s === 'healthy' ? THEME.success : s === 'bloated' ? THEME.warning : THEME.danger;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${THEME.grid}`, display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {['all', 'healthy', 'bloated', 'unused'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${filter === f ? THEME.primary : THEME.grid}`, background: filter === f ? `${THEME.primary}20` : 'transparent', color: filter === f ? THEME.primary : THEME.textMuted, fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{f}</button>
                ))}
            </div>
            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.grid}` }}>
                        {['Table', 'Column', 'Type', 'Size', 'Scans/mo', 'Bloat', 'Status', 'Action'].map(h => (
                            <th key={h} style={{ padding: '20px 24px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em' }}>{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map((idx, i) => (
                        <tr key={i} className="opt-row-hover" style={{ borderBottom: `1px solid ${THEME.grid}30` }}>
                            <td style={{ padding: '9px 12px', color: THEME.textMain, fontFamily: 'monospace' }}>{idx?.table || '?'}</td>
                            <td style={{ padding: '9px 12px', color: THEME.primary, fontFamily: 'monospace' }}>{idx?.column || '?'}</td>
                            <td style={{ padding: '9px 12px' }}><span style={{ padding: '2px 6px', borderRadius: 16, background: `${THEME.grid}60`, fontSize: 9, fontFamily: 'monospace', color: THEME.textMuted }}>{idx?.type || '?'}</span></td>
                            <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{idx?.size || '—'}</td>
                            <td style={{ padding: '9px 12px', color: (idx?.scans || 0) === 0 ? THEME.danger : THEME.textMuted }}>{((idx?.scans) || 0).toLocaleString()}</td>
                            <td style={{ padding: '9px 12px', color: parseFloat(idx?.bloat || '0') > 20 ? THEME.warning : THEME.textMuted }}>{idx?.bloat || '0'}</td>
                            <td style={{ padding: '9px 12px' }}><span style={{ padding: '2px 7px', borderRadius: 20, background: `${statusColor(idx?.status)}18`, color: statusColor(idx?.status), fontSize: 9, fontWeight: 700 }}>{idx?.status || '?'}</span></td>
                            <td style={{ padding: '9px 12px' }}>
                                {idx?.status === 'unused' && <button style={{ fontSize: 9, padding: '2px 8px', borderRadius: 16, background: `${THEME.danger}15`, color: THEME.danger, border: `1px solid ${THEME.danger}30`, cursor: 'pointer' }}>DROP</button>}
                                {idx?.status === 'bloated' && <button style={{ fontSize: 9, padding: '2px 8px', borderRadius: 16, background: `${THEME.warning}15`, color: THEME.warning, border: `1px solid ${THEME.warning}30`, cursor: 'pointer' }}>REINDEX</button>}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Table Stats
const TableStatsPanel = ({ tableStats = [] }) => {
    const safeTableStats = Array.isArray(tableStats) ? tableStats : [];
    const maxRows = safeTableStats.length > 0 ? Math.max(...safeTableStats.map(t => t.rows || 0)) : 1;
    return (
        <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="opt-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                    <tr style={{ borderBottom: `1px solid ${THEME.grid}` }}>
                        {['Table', 'Rows', 'Size', 'Dead Tuples', 'Last Vacuum', 'Seq Scans', 'Idx Scans', 'Idx Hit %'].map(h => (
                            <th key={h} style={{ padding: '20px 24px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: THEME.textDim,  letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {safeTableStats.map((t, i) => {
                        const seqScans = t?.seq_scans || 0;
                        const idxScans = t?.idx_scans || 0;
                        const total = seqScans + idxScans;
                        const idxPct = total > 0 ? (idxScans / total) * 100 : 0;
                        const deadRatio = (t.dead_tuples || 0) / (t.rows || 1);
                        return (
                            <tr key={i} className="opt-row-hover" style={{ borderBottom: `1px solid ${THEME.grid}30` }}>
                                <td style={{ padding: '9px 12px', color: THEME.textMain, fontFamily: 'monospace', fontWeight: 600 }}>{t?.table || '—'}</td>
                                <td style={{ padding: '9px 12px' }}>
                                    <div style={{ fontSize: 11, color: THEME.textMain }}>{formatRows(t?.rows || 0)}</div>
                                    <div style={{ width: 60, height: 3, background: `${THEME.grid}40`, borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
                                        <div style={{ width: `${((t?.rows || 0) / maxRows) * 100}%`, height: '100%', background: THEME.primary }} />
                                    </div>
                                </td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{t?.size || '—'}</td>
                                <td style={{ padding: '9px 12px', color: deadRatio > 0.1 ? THEME.danger : deadRatio > 0.05 ? THEME.warning : THEME.textMuted }}>
                                    {formatRows(t?.dead_tuples || 0)}{deadRatio > 0.05 && <span style={{ marginLeft: 4, color: THEME.warning }}>⚠</span>}
                                </td>
                                <td style={{ padding: '9px 12px', color: (t?.last_vacuum || '').includes('d') ? THEME.danger : THEME.textMuted }}>{t?.last_vacuum || 'never'}</td>
                                <td style={{ padding: '9px 12px', color: seqScans > 1000 ? THEME.warning : THEME.textMuted }}>{(seqScans || 0).toLocaleString()}</td>
                                <td style={{ padding: '9px 12px', color: THEME.textMuted }}>{(idxScans || 0).toLocaleString()}</td>
                                <td style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 48, height: 5, background: `${THEME.grid}40`, borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${idxPct}%`, height: '100%', background: idxPct > 80 ? THEME.success : THEME.warning }} />
                                        </div>
                                        <span style={{ fontSize: 9, color: THEME.textMuted }}>{idxPct.toFixed(0)}%</span>
                                    </div>
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

// Compare Panel
const ComparePanel = () => {
    const [queryA, setQueryA] = useState(SAMPLE_QUERIES[0]?.sql || '');
    const [queryB, setQueryB] = useState(SAMPLE_QUERIES[2]?.sql || '');
    const [resultA, setResultA] = useState(null);
    const [resultB, setResultB] = useState(null);
    const [loading, setLoading] = useState(false);

    const runBoth = async () => {
        setLoading(true);
        await new Promise(r => setTimeout(r, 1400));
        setResultA(generateMockPlan(queryA));
        setResultB(generateMockPlan(queryB));
        setLoading(false);
    };

    const DiffBadge = ({ a, b, label }) => {
        if (!a || !b) return null;
        const diff = b - a, pct = ((diff / a) * 100).toFixed(1), better = diff < 0;
        return (
            <div style={{ textAlign: 'center', padding: '20px 24px', borderRadius: 18, background: better ? `${THEME.success}10` : `${THEME.danger}10`, border: `1px solid ${better ? THEME.success : THEME.danger}25` }}>
                <div style={{ fontSize: 9, color: THEME.textDim, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: better ? THEME.success : THEME.danger }}>{better ? '▼' : '▲'} {Math.abs(pct)}%</div>
                <div style={{ fontSize: 9, color: THEME.textMuted }}>B vs A</div>
            </div>
        );
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${THEME.grid}`, display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: THEME.textDim }}>Compare two query variants side-by-side</span>
                <div style={{ marginLeft: 'auto' }}>
                    <button onClick={runBoth} disabled={loading} className="opt-btn" style={{ padding: '6px 16px', borderRadius: 18, border: 'none', background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary || THEME.primary})`, color: '#fff', fontSize: 11, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}>
                        {loading ? <RefreshCw size={13} style={{ animation: 'optSpin 1s linear infinite' }} /> : <GitCompare size={13} />}
                        {loading ? 'Running…' : 'Compare Both'}
                    </button>
                </div>
            </div>

            <div style={{ flex: '0 0 170px', display: 'flex', borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                {[{ label: 'Query A', q: queryA, setQ: setQueryA, r: resultA, color: THEME.primary }, { label: 'Query B', q: queryB, setQ: setQueryB, r: resultB, color: THEME.warning }].map((p, idx) => (
                    <div key={idx} style={{ flex: 1, borderRight: idx === 0 ? `1px solid ${THEME.grid}` : 'none', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '5px 12px', background: THEME.surface, borderBottom: `1px solid ${THEME.grid}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: p.color }}>{p.label}</span>
                            {p.r && <span style={{ fontSize: 9, color: THEME.textMuted }}>Cost: <strong style={{ color: THEME.textMain }}>{p.r.Plan["Total Cost"].toFixed(1)}</strong> · {formatDuration(p.r.Plan["Actual Total Time"])}</span>}
                        </div>
                        <textarea value={p.q} onChange={e => p.setQ(e.target.value)} className="sql-editor" spellCheck="false" style={{ flex: 1, background: 'transparent', color: THEME.textMain, border: 'none', padding: 12, resize: 'none', outline: 'none', fontSize: 11 }} />
                    </div>
                ))}
            </div>

            {resultA && resultB && (
                <div style={{ padding: '16px 22px', display: 'flex', gap: 22, background: THEME.surface, borderBottom: `1px solid ${THEME.grid}`, flexShrink: 0 }}>
                    <DiffBadge a={resultA.Plan["Total Cost"]} b={resultB.Plan["Total Cost"]} label="Cost" />
                    <DiffBadge a={resultA.Plan["Actual Total Time"]} b={resultB.Plan["Actual Total Time"]} label="Exec Time" />
                    <DiffBadge a={resultA.Plan["Shared Read Blocks"] || 1} b={resultB.Plan["Shared Read Blocks"] || 1} label="Disk Reads" />
                </div>
            )}

            {resultA && resultB ? (
                <div style={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
                    {[{ r: resultA }, { r: resultB }].map(({ r }, idx) => (
                        <div key={idx} className="opt-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 14, borderRight: idx === 0 ? `1px solid ${THEME.grid}` : 'none' }}>
                            <PlanNode node={r.Plan} maxCost={r.Plan["Total Cost"]} totalTime={r.Plan["Actual Total Time"]} />
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.textDim, flexDirection: 'column', gap: 22 }}>
                    <GitCompare size={36} opacity={0.3} />
                    <div style={{ fontSize: 12 }}>Click "Compare Both" to see side-by-side execution plans</div>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const QueryOptimizerTab = () => {
    useAdaptiveTheme();
    const [query, setQuery] = useState(SAMPLE_QUERIES[0]?.sql || '');
    const [history, setHistory] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [viewMode, setViewMode] = useState('visual');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSamples, setShowSamples] = useState(false);
    const [activeTab, setActiveTab] = useState('plan');
    const [copiedQuery, setCopiedQuery] = useState(false);
    // Notebook-style state: which extra cells the user has opened from the palette / tool pad.
    // The Plan, Insights and AI Rewrite cells are always visible when a plan exists; everything
    // else is opt-in. Order in array = render order, newest at top.
    const [openCells, setOpenCells] = useState([]);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteQuery, setPaletteQuery] = useState('');
    const [paletteIndex, setPaletteIndex] = useState(0);
    const editorRef = useRef(null);
    const paletteInputRef = useRef(null);

    const openCell = useCallback((id) => {
        setOpenCells(prev => prev.includes(id) ? prev : [id, ...prev]);
        setPaletteOpen(false);
        // Scroll the new cell into view shortly after it mounts.
        setTimeout(() => {
            const el = document.querySelector(`[data-cell-id="${id}"]`);
            if (el && 'scrollIntoView' in el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    }, []);
    const closeCell = useCallback((id) => {
        setOpenCells(prev => prev.filter(x => x !== id));
    }, []);

    // Optimizer data state
    const [indexes, setIndexes] = useState([]);
    const [tableStats, setTableStats] = useState([]);
    const [slowQueries, setSlowQueries] = useState([]);
    const [locks, setLocks] = useState([]);
    const [maintenance, setMaintenance] = useState([]);
    const [pgConfig, setPgConfig] = useState([]);
    const [serviceAttribution, setServiceAttribution] = useState([]);
    const [paramIssues, setParamIssues] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadQuery = useCallback((sql) => {
        setQuery(sql);
        setActiveTab('plan');
    }, []);

    // Fetch optimizer data from API endpoints
    useEffect(() => {
        const loadOptimizerData = async () => {
            setLoading(true);
            try {
                const results = await Promise.allSettled([
                    fetchData('/api/optimizer/indexes'),
                    fetchData('/api/optimizer/table-stats'),
                    fetchData('/api/optimizer/slow-queries'),
                    fetchData('/api/optimizer/locks'),
                    fetchData('/api/optimizer/maintenance'),
                    fetchData('/api/optimizer/config'),
                    fetchData('/api/optimizer/service-attribution'),
                    fetchData('/api/optimizer/param-issues'),
                ]);

                // Helper to safely extract arrays from API responses, handling error objects
                const toArray = (result) => {
                    if (result.status !== 'fulfilled') return [];
                    const value = result.value;
                    if (Array.isArray(value)) return value;
                    if (value?.error) return [];
                    return Array.isArray(value?.data) ? value.data : [];
                };

                setIndexes(toArray(results[0]));
                setTableStats(toArray(results[1]));
                setSlowQueries(toArray(results[2]));
                setLocks(toArray(results[3]));
                setMaintenance(toArray(results[4]));
                setPgConfig(toArray(results[5]));
                setServiceAttribution(toArray(results[6]));
                setParamIssues(toArray(results[7]));
            } catch (e) {
                console.error('Failed to load optimizer data:', e);
                // Ensure all state is set to empty arrays even if an error occurs
                setIndexes([]);
                setTableStats([]);
                setSlowQueries([]);
                setLocks([]);
                setMaintenance([]);
                setPgConfig([]);
                setServiceAttribution([]);
                setParamIssues([]);
            } finally {
                setLoading(false);
            }
        };

        loadOptimizerData();
    }, []);

    // Global keyboard shortcuts: ⌘K / Ctrl+K opens the palette, Esc closes it.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(true);
                setPaletteQuery('');
                setPaletteIndex(0);
                setTimeout(() => paletteInputRef.current?.focus(), 30);
            }
            if (e.key === 'Escape' && paletteOpen) {
                setPaletteOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [paletteOpen]);

    const handleAnalyze = async () => {
        if (!query.trim()) return;
        setAnalyzing(true);
        try {
            const raw = await postData('/api/optimizer/analyze', { query });
            // PostgreSQL EXPLAIN (FORMAT JSON) returns { "QUERY PLAN": [{ Plan, "Planning Time", "Execution Time" }] }
            const plan = raw?.["QUERY PLAN"]?.[0] || raw?.[0] || raw;
            if (!plan || !plan.Plan) {
                console.error('Invalid plan response:', raw);
                setAnalyzing(false);
                return;
            }
            setResult(plan);
            // Publish to the shared store so the Query Plan Viewer tab
            // can render this plan when the user switches over.
            setLatestPlan(plan, query);
            setHistory(prev => [{ id: Date.now(), query: query.substring(0, 52) + (query.length > 52 ? '…' : ''), fullQuery: query, timestamp: new Date().toLocaleTimeString(), cost: plan.Plan["Total Cost"] || 0, time: plan.Plan["Actual Total Time"] || 0 }, ...prev.slice(0, 19)]);
            setActiveTab('plan');
        } catch (err) { console.error(err); }
        finally { setAnalyzing(false); }
    };

    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleAnalyze(); }
    };

    const copyQuery = () => { navigator.clipboard?.writeText(query).catch(() => {}); setCopiedQuery(true); setTimeout(() => setCopiedQuery(false), 1800); };

    const exportPlan = () => {
        if (!result) return;
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'query_plan.json'; a.click();
        URL.revokeObjectURL(url);
    };

    const rootNode = result?.Plan;
    const maxCost = rootNode?.["Total Cost"] || 100;
    const totalTime = rootNode?.["Actual Total Time"] || 100;
    const bufferHit = rootNode?.["Shared Hit Blocks"] || 0;
    const bufferRead = rootNode?.["Shared Read Blocks"] || 0;
    const hitRate = ((bufferHit / (bufferHit + bufferRead || 1)) * 100).toFixed(1);

    const { insights, indexRecommendations, rewrites } = useMemo(() => {
        if (!result) return { insights: [], indexRecommendations: [], rewrites: [] };
        return analyzePlan(result);
    }, [result]);

    const heatmapData = useMemo(() => result ? getHeatmapData(result.Plan) : null, [result]);

    // Tool catalog — drives the command palette and the tool launcher pad in the right rail.
    // Each entry is one "cell" the user can open in the notebook below.
    const TOOL_CATALOG = [
        { id: 'plan-viewer',      label: 'Plan Viewer',      icon: Workflow,        kbd: 'P',     hint: 'zoom & inspect plan tree',         group: 'Plan' },
        { id: 'flamegraph',       label: 'Flamegraph',       icon: Flame,           kbd: 'F',     hint: 'time share by node',                group: 'Plan' },
        { id: 'breakdown',        label: 'Cost Breakdown',   icon: BarChart3,       kbd: 'B',     hint: 'buffers, timing, workers',          group: 'Plan' },
        { id: 'ai-rewrite',       label: 'AI Rewrite',       icon: Wand2,           kbd: 'A',     hint: 'suggest a faster query',            group: 'Advisors', isNew: true },
        { id: 'indexes',          label: 'Index Advisor',    icon: Layers,          kbd: 'I',     hint: 'missing / unused indexes',          group: 'Advisors' },
        { id: 'parameterization', label: 'Param Advisor',    icon: ShieldAlert,     kbd: 'R',     hint: 'parameterization issues',           group: 'Advisors', isNew: true },
        { id: 'attribution',      label: 'Cost Attribution', icon: Building2,       kbd: 'T',     hint: 'cost by service / team',            group: 'Advisors', isNew: true },
        { id: 'slow',             label: 'Slow Queries',     icon: TrendingDown,    kbd: 'S',     hint: 'top offenders from pg_stat',        group: 'Inspect' },
        { id: 'locks',            label: 'Lock Monitor',     icon: Lock,            kbd: 'L',     hint: 'live blocking locks',               group: 'Inspect' },
        { id: 'tables',           label: 'Table Stats',      icon: Table,           kbd: 'X',     hint: 'rows, size, bloat',                 group: 'Inspect' },
        { id: 'maintenance',      label: 'Maintenance',      icon: Wrench,          kbd: 'M',     hint: 'vacuum / analyze status',           group: 'Tune' },
        { id: 'config',           label: 'PG Config',        icon: SlidersHorizontal, kbd: 'C',   hint: 'tunables & recommendations',        group: 'Tune' },
        { id: 'compare',          label: 'Compare',          icon: GitCompare,      kbd: 'D',     hint: 'diff two plans',                    group: 'Tune' },
    ];
    const TOOL_BY_ID = Object.fromEntries(TOOL_CATALOG.map(t => [t.id, t]));

    // Filtered palette results (simple substring match on label + hint + group).
    const paletteResults = useMemo(() => {
        const q = paletteQuery.trim().toLowerCase();
        if (!q) return TOOL_CATALOG;
        return TOOL_CATALOG.filter(t =>
            t.label.toLowerCase().includes(q) ||
            t.hint.toLowerCase().includes(q) ||
            t.group.toLowerCase().includes(q) ||
            t.id.toLowerCase().includes(q)
        );
    }, [paletteQuery]);

    // Renders one tool's panel body. Centralized so a cell can host any tool by id.
    const renderToolBody = (id) => {
        switch (id) {
            case 'plan-viewer':
                return <div style={{ padding: 14, minHeight: 360 }}><QueryPlanViewer planData={result} /></div>;
            case 'ai-rewrite':
                return <AIRewritePanel query={query} insights={insights} onApplyRewrite={(rewritten) => { setQuery(rewritten); closeCell('ai-rewrite'); }} />;
            case 'attribution':
                return <ServiceAttributionPanel serviceAttribution={serviceAttribution} />;
            case 'parameterization':
                return <ParameterizationAdvisorPanel paramIssues={paramIssues} />;
            case 'indexes':
                return <IndexAdvisorPanel indexes={indexes} />;
            case 'tables':
                return <TableStatsPanel tableStats={tableStats} />;
            case 'compare':
                return <ComparePanel />;
            case 'slow':
                return <SlowQueryPanel onLoadQuery={loadQuery} slowQueries={slowQueries} />;
            case 'locks':
                return <LockMonitorPanel locks={locks} />;
            case 'maintenance':
                return <MaintenancePanel maintenance={maintenance} />;
            case 'config':
                return <ConfigAdvisorPanel pgConfig={pgConfig} />;
            case 'flamegraph':
                return !result
                    ? <div style={{ textAlign: 'center', color: THEME.textDim, padding: '40px 24px', fontSize: 13 }}>Run a query first to see the flamegraph</div>
                    : <div style={{ padding: 20 }}><FlameGraph plan={result} /></div>;
            case 'breakdown':
                return !result
                    ? <div style={{ textAlign: 'center', color: THEME.textDim, padding: '40px 24px', fontSize: 13 }}>Run a query first to see cost breakdown</div>
                    : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
                            <div className="opt-card" style={{ padding: 18, borderRadius: 14 }}>
                                <h3 style={{ fontSize: 11, fontWeight: 700, color: THEME.textDim, margin: '0 0 14px', letterSpacing: '0.02em' }}>Node-by-Node Cost &amp; Time</h3>
                                <CostBreakdownChart plan={result} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="opt-card" style={{ padding: 18, borderRadius: 14 }}>
                                    <h3 style={{ fontSize: 11, fontWeight: 700, color: THEME.textDim, margin: '0 0 12px', letterSpacing: '0.02em' }}>Buffer Usage</h3>
                                    {[
                                        { label: 'Shared Hit Blocks',   value: result.Plan["Shared Hit Blocks"]   || 0, color: THEME.success, desc: 'From cache' },
                                        { label: 'Shared Read Blocks',  value: result.Plan["Shared Read Blocks"]  || 0, color: THEME.danger,  desc: 'From disk' },
                                        { label: 'Temp Blocks Written', value: result.Plan["Temp Written Blocks"] || 0, color: THEME.warning, desc: 'Spilled to disk' },
                                    ].map((b, i) => (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                                <span style={{ color: THEME.textMuted }}>{b.label}</span>
                                                <span style={{ color: b.color, fontWeight: 700 }}>{b.value.toLocaleString()}</span>
                                            </div>
                                            <div style={{ height: 6, background: `${THEME.grid}40`, borderRadius: 16, overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.min(100, (b.value / ((result.Plan["Shared Hit Blocks"] || 1) + (result.Plan["Shared Read Blocks"] || 1))) * 100)}%`, height: '100%', background: b.color, borderRadius: 3 }} />
                                            </div>
                                            <div style={{ fontSize: 9, color: THEME.textDim, marginTop: 2 }}>{b.desc} · {formatBytes(b.value * 8192)}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="opt-card" style={{ padding: 18, borderRadius: 14 }}>
                                    <h3 style={{ fontSize: 11, fontWeight: 700, color: THEME.textDim, margin: '0 0 12px', letterSpacing: '0.02em' }}>Timing Summary</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        {[
                                            { label: 'Planning',        val: formatDuration(result["Planning Time"]  || 1.2),         color: THEME.textDim },
                                            { label: 'Execution',       val: formatDuration(result["Execution Time"] || totalTime),   color: THEME.primary },
                                            { label: 'Buffer Hit Rate', val: `${hitRate}%`,                                           color: parseFloat(hitRate) > 90 ? THEME.success : THEME.warning },
                                            { label: 'Workers',         val: `${result.Plan["Workers Launched"] || 0}`,               color: THEME.textMuted },
                                        ].map((s, i) => (
                                            <div key={i} style={{ textAlign: 'center', padding: 10, borderRadius: 16, background: `${THEME.grid}30` }}>
                                                <div style={{ fontSize: 9, color: THEME.textDim, marginBottom: 4 }}>{s.label}</div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
            default:
                return <div style={{ padding: 16, color: THEME.textDim }}>Tool not found.</div>;
        }
    };

    // Reusable cell wrapper.
    const Cell = ({ id, title, meta, icon: Icon, accent, action, children, closable = true }) => (
        <div data-cell-id={id} className="opt-card" style={{ borderRadius: 14, overflow: 'hidden', animation: 'optFadeIn 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${THEME.glassBorder}` }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, background: `${accent || THEME.primary}18`, color: accent || THEME.primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {Icon && <Icon size={14} />}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain, lineHeight: 1.2 }}>{title}</div>
                    {meta && <div style={{ fontSize: 11, color: THEME.textDim, marginTop: 2 }}>{meta}</div>}
                </div>
                {action}
                {closable && (
                    <button onClick={() => closeCell(id)} title="Close" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid transparent', background: 'transparent', color: THEME.textDim, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={14} />
                    </button>
                )}
            </div>
            {children}
        </div>
    );

    return (
        <div style={{ minHeight: '100%', background: THEME.bg, color: THEME.textMain, margin: '-32px', display: 'flex', flexDirection: 'column' }}>
            <OptimizerStyles />

            {/* HERO BAND */}
            <div style={{
                borderBottom: `1px solid ${THEME.grid}`,
                background: `radial-gradient(1200px 240px at 8% -20%, ${THEME.primary}14, transparent 60%), radial-gradient(900px 220px at 92% -30%, ${THEME.secondary || THEME.primary}12, transparent 60%), ${THEME.surface}`,
                padding: '18px 28px 14px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ padding: 7, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.primary}25, ${THEME.secondary || THEME.primary}25)`, border: `1px solid ${THEME.primary}30` }}>
                        <Zap size={16} color={THEME.primary} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>Query Optimizer</div>
                        <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>EXPLAIN ANALYZE · Plan Viewer · AI Rewrite · Index &amp; Param Advisors · Cost Attribution</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <ActiveUsersBadge />
                    {result && (
                        <button onClick={exportPlan} className="opt-btn" title="Export plan JSON" style={{ height: 34, padding: '0 12px', borderRadius: 10, border: `1px solid ${THEME.grid}`, background: THEME.surface, color: THEME.textMuted, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Download size={13} /> Export
                        </button>
                    )}
                </div>
            </div>

            {/* COMMAND BAR */}
            <div style={{ padding: '18px 28px 0' }}>
                <div onClick={() => { setPaletteOpen(true); setPaletteQuery(''); setPaletteIndex(0); setTimeout(() => paletteInputRef.current?.focus(), 30); }}
                     className="opt-card"
                     style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, cursor: 'text' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${THEME.grid}30`, border: `1px solid ${THEME.grid}`, color: THEME.textMuted, padding: '5px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>
                        <Search size={12} /> Jump to
                    </span>
                    <span style={{ flex: 1, color: THEME.textDim, fontSize: 14 }}>
                        Open a tool, run a query, or search insights…  <span style={{ opacity: 0.7 }}>e.g. &ldquo;show locks&rdquo;, &ldquo;rewrite query&rdquo;, &ldquo;flamegraph&rdquo;</span>
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, padding: '3px 7px', borderRadius: 6, background: `${THEME.grid}40`, border: `1px solid ${THEME.grid}`, color: THEME.textDim }}>⌘ K</span>
                </div>
            </div>

            {/* QUICK CHIPS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 28px 8px' }}>
                {[
                    { label: 'Run query', icon: Play, kbd: '⌘ ↵', onClick: handleAnalyze, disabled: analyzing || !query.trim() },
                    { label: 'AI rewrite', icon: Wand2, onClick: () => openCell('ai-rewrite') },
                    { label: 'Slow queries', icon: TrendingDown, onClick: () => openCell('slow') },
                    { label: 'Active locks', icon: Lock, onClick: () => openCell('locks') },
                    { label: 'Index advisor', icon: Layers, onClick: () => openCell('indexes') },
                    { label: 'Compare plans', icon: GitCompare, onClick: () => openCell('compare') },
                    { label: 'Samples', icon: BookOpen, onClick: () => setShowSamples(s => !s) },
                ].map((c, i) => (
                    <button key={i} onClick={c.onClick} disabled={c.disabled} className="opt-btn" style={{ border: `1px solid ${THEME.grid}`, background: THEME.surface, color: THEME.textMuted, borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 500, cursor: c.disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: c.disabled ? 0.5 : 1 }}>
                        <c.icon size={12} /> {c.label}
                        {c.kbd && <span style={{ marginLeft: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: THEME.textDim }}>{c.kbd}</span>}
                    </button>
                ))}
            </div>

            {/* SAMPLES strip */}
            {showSamples && (
                <div style={{ padding: '4px 28px 14px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {SAMPLE_QUERIES.map((s, i) => (
                        <button key={i} onClick={() => { setQuery(s.sql); setShowSamples(false); editorRef.current?.focus(); }} className="opt-btn"
                            style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${THEME.glassBorder}`, background: 'transparent', color: THEME.textMuted, fontSize: 10.5, cursor: 'pointer' }}>
                            {s.label}
                        </button>
                    ))}
                </div>
            )}

            {/* WORKSPACE (notebook + side stack) */}
            <div style={{ padding: '6px 28px 60px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 22, alignItems: 'start' }}>

                {/* LEFT COLUMN — editor + result cells */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

                    {/* Editor cell */}
                    <div className="opt-card" style={{ borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${THEME.glassBorder}` }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: THEME.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>SQL Query</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: THEME.textMuted, padding: '3px 8px', borderRadius: 6, background: `${THEME.grid}30`, border: `1px solid ${THEME.grid}` }}>
                                <Database size={11} /> postgres
                            </span>
                            <div style={{ flex: 1 }} />
                            <button onClick={copyQuery} className="opt-btn" title="Copy SQL" style={{ height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${THEME.grid}`, background: 'transparent', color: THEME.textMuted, fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                {copiedQuery ? <Check size={12} color={THEME.success} /> : <Copy size={12} />} Copy
                            </button>
                            {result && (
                                <button onClick={exportPlan} className="opt-btn" title="Export plan JSON" style={{ height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${THEME.grid}`, background: 'transparent', color: THEME.textMuted, fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                    <Download size={12} /> Plan
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', minHeight: 180 }}>
                            <div style={{ width: 44, background: `${THEME.grid}20`, borderRight: `1px solid ${THEME.glassBorder}`, padding: '12px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: THEME.textDim, textAlign: 'center', userSelect: 'none', flexShrink: 0 }}>
                                {query.split('\n').map((_, i) => (
                                    <div key={i} style={{ lineHeight: '22.4px', opacity: 0.55 }}>{i + 1}</div>
                                ))}
                            </div>
                            <textarea
                                ref={editorRef}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="sql-editor opt-scroll"
                                spellCheck="false" autoCorrect="off"
                                style={{ flex: 1, minHeight: 180, background: 'transparent', color: THEME.textMain, border: 'none', padding: '12px 16px', resize: 'vertical', outline: 'none', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.75, boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${THEME.glassBorder}` }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: THEME.textDim, fontSize: 11.5 }}>
                                <span style={{ padding: '3px 8px', borderRadius: 6, background: `${THEME.grid}30`, color: THEME.textMuted, fontSize: 11 }}>
                                    {query.split('\n').length} lines · {query.length} chars
                                </span>
                                {history.length > 0 && <span>Last run · {history[0]?.timestamp}</span>}
                            </div>
                            <button onClick={handleAnalyze} disabled={analyzing || !query.trim()} className="opt-btn"
                                style={{ height: 36, padding: '0 18px', borderRadius: 10, background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary || THEME.primary})`, color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: analyzing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: `0 6px 14px ${THEME.primary}40`, opacity: analyzing || !query.trim() ? 0.7 : 1 }}>
                                {analyzing ? <><RefreshCw size={14} style={{ animation: 'optSpin 1s linear infinite' }} /> Analyzing…</> : <><Play size={14} fill="currentColor" /> Explain Analyze</>}
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: 5, marginLeft: 2 }}>⌘ ↵</span>
                            </button>
                        </div>
                    </div>

                    {/* Empty state when no plan run yet */}
                    {!result && !analyzing && (
                        <div className="opt-card" style={{ borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: 16, background: `${THEME.grid}30`, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Layers size={28} opacity={0.4} />
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Ready to optimize</div>
                            <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 18, maxWidth: 500, margin: '0 auto 18px' }}>
                                Paste a query and click <b>Explain Analyze</b> — or hit <span style={{ fontFamily: 'JetBrains Mono, monospace', padding: '1px 6px', borderRadius: 4, background: `${THEME.grid}40`, fontSize: 11 }}>⌘K</span> to open any of the 13 tools below.
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: THEME.textDim, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {['Execution plan tree', 'Cost & time breakdown', 'AI query rewrite', 'Heatmap overlay', 'Index recommendations'].map(f => (
                                    <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} color={THEME.success} /> {f}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Plan cell — always visible when a plan exists */}
                    {result && (
                        <Cell id="plan" title="Execution Plan" icon={Share2} accent={THEME.primary}
                              meta={`${formatDuration(result["Execution Time"] || totalTime)} · ${formatRows(result.Plan["Actual Rows"])} rows · ${insights.length} insight${insights.length === 1 ? '' : 's'}`}
                              closable={false}
                              action={
                                  <div style={{ display: 'flex', gap: 6 }}>
                                      <button onClick={() => setShowHeatmap(!showHeatmap)} className="opt-btn" style={{ padding: '4px 10px', borderRadius: 16, border: `1px solid ${showHeatmap ? THEME.danger : THEME.grid}`, background: showHeatmap ? `${THEME.danger}18` : 'transparent', color: showHeatmap ? THEME.danger : THEME.textMuted, fontSize: 10.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <Flame size={11} /> {showHeatmap ? 'Heatmap ON' : 'Heatmap'}
                                      </button>
                                      {['visual', 'json'].map(mode => (
                                          <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '4px 9px', borderRadius: 16, border: `1px solid ${viewMode === mode ? THEME.primary : THEME.grid}`, background: viewMode === mode ? `${THEME.primary}20` : 'transparent', color: viewMode === mode ? THEME.primary : THEME.textMuted, fontSize: 10.5, cursor: 'pointer', textTransform: 'capitalize' }}>{mode}</button>
                                      ))}
                                  </div>
                              }>
                            {/* KPI strip */}
                            <div style={{ padding: '14px 16px', display: 'flex', gap: 14, borderBottom: `1px solid ${THEME.glassBorder}`, alignItems: 'stretch' }}>
                                <QueryScoreRing insights={insights} />
                                <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                                    {[
                                        { label: 'Total Cost', value: result.Plan["Total Cost"].toFixed(2), color: THEME.textMain },
                                        { label: 'Planning',   value: formatDuration(result["Planning Time"] || 0), color: THEME.textDim },
                                        { label: 'Execution',  value: formatDuration(result["Execution Time"] || totalTime), color: THEME.primary },
                                        { label: 'Buffer Hit', value: `${hitRate}%`, color: parseFloat(hitRate) > 90 ? THEME.success : THEME.warning },
                                        { label: 'Rows Out',   value: formatRows(result.Plan["Actual Rows"]), color: THEME.info || THEME.primary },
                                    ].map((stat, i) => (
                                        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: `${THEME.grid}25`, border: `1px solid ${THEME.glassBorder}` }}>
                                            <div style={{ fontSize: 9.5, fontWeight: 700, color: THEME.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
                                            <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Plan tree */}
                            <div className="opt-scroll" style={{ maxHeight: 520, overflowY: 'auto', padding: '14px 16px' }}>
                                {viewMode === 'visual'
                                    ? <PlanNode node={result.Plan} maxCost={maxCost} totalTime={totalTime} heatmapData={heatmapData?.heatmap} showHeatmap={showHeatmap} />
                                    : <pre style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: THEME.textMuted, margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
                                }
                            </div>
                            {showHeatmap && (
                                <div style={{ padding: '6px 16px', borderTop: `1px solid ${THEME.glassBorder}`, display: 'flex', gap: 16, alignItems: 'center', background: `${THEME.danger}05` }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ display: 'flex', height: 6, width: 80, borderRadius: 16, overflow: 'hidden' }}>
                                            {Array.from({length:20}, (_, i) => (
                                                <div key={i} style={{ flex:1, background:`rgba(${Math.round(220*i/19)},${Math.round(60*(1-i/19))},0,0.8)` }} />
                                            ))}
                                        </div>
                                        <span style={{ fontSize: 10, color: THEME.textDim }}>Cool → Hot</span>
                                    </div>
                                    <span style={{ fontSize: 10, color: THEME.danger, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Flame size={10} /> Nodes above 70% time share are HOTSPOTS
                                    </span>
                                </div>
                            )}
                        </Cell>
                    )}

                    {/* Insights cell — visible when a plan exists and there are insights */}
                    {result && insights.length > 0 && (
                        <Cell id="insights" title="Insights" icon={Sparkles} accent={THEME.danger}
                              meta={`${insights.length} found · ${insights.filter(i => i.severity === 'critical').length} critical`}
                              closable={false}
                              action={
                                  <button onClick={() => openCell('ai-rewrite')} className="opt-btn" style={{ height: 26, padding: '0 10px', borderRadius: 7, border: `1px solid ${THEME.primary}30`, background: `${THEME.primary}10`, color: THEME.primary, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                      <Wand2 size={12} /> Fix with AI
                                  </button>
                              }>
                            <InsightsPanel insights={insights} rewrites={rewrites} indexRecs={indexRecommendations} />
                        </Cell>
                    )}

                    {/* User-opened tool cells */}
                    {openCells.map(id => {
                        const tool = TOOL_BY_ID[id];
                        if (!tool) return null;
                        return (
                            <Cell key={id} id={id} title={tool.label} meta={tool.hint} icon={tool.icon} accent={THEME.primary}>
                                {renderToolBody(id)}
                            </Cell>
                        );
                    })}
                </div>

                {/* RIGHT SIDE STACK */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16, alignSelf: 'start' }}>
                    {/* Recent runs */}
                    <div className="opt-card" style={{ borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${THEME.glassBorder}`, fontSize: 10.5, fontWeight: 700, color: THEME.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <History size={12} /> Recent runs
                            {history.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10, color: THEME.textMuted, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{history.length}</span>}
                        </div>
                        <div style={{ padding: '6px 12px' }}>
                            {history.length === 0 ? (
                                <div style={{ padding: '14px 4px', fontSize: 11.5, color: THEME.textDim, textAlign: 'center' }}>No queries yet</div>
                            ) : (
                                history.slice(0, 6).map(item => (
                                    <div key={item.id} onClick={() => setQuery(item.fullQuery)} className="opt-row-hover" style={{ padding: '8px 4px', borderBottom: `1px solid ${THEME.glassBorder}`, cursor: 'pointer' }}>
                                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: THEME.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.query}</div>
                                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: THEME.textMuted, marginTop: 2 }}>
                                            <span>{item.timestamp}</span>
                                            <span style={{ marginLeft: 'auto', color: item.time > 100 ? THEME.warning : item.time < 10 ? THEME.success : THEME.textMuted, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(item.time)}</span>
                                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>cost {item.cost.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Tools launcher pad */}
                    <div className="opt-card" style={{ borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${THEME.glassBorder}`, fontSize: 10.5, fontWeight: 700, color: THEME.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PackageOpen size={12} /> Tools
                            <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: THEME.textDim, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>⌘K for all</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 10 }}>
                            {TOOL_CATALOG.slice(0, 8).map(t => {
                                const open = openCells.includes(t.id);
                                return (
                                    <button key={t.id} onClick={() => open ? closeCell(t.id) : openCell(t.id)} className="opt-btn"
                                        style={{ padding: '9px 10px', borderRadius: 9, border: `1px solid ${open ? THEME.primary : THEME.glassBorder}`, background: open ? `${THEME.primary}12` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                                        <span style={{ width: 24, height: 24, borderRadius: 6, background: `${THEME.grid}40`, color: open ? THEME.primary : THEME.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <t.icon size={12} />
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 11.5, fontWeight: 600, color: THEME.textMain, lineHeight: 1.2 }}>{t.label}</div>
                                            {t.isNew && <span style={{ fontSize: 8.5, color: THEME.primary, fontWeight: 800, letterSpacing: '0.04em' }}>NEW</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Session info */}
                    <div className="opt-card" style={{ borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${THEME.glassBorder}`, fontSize: 10.5, fontWeight: 700, color: THEME.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Settings size={12} /> Session
                        </div>
                        <div style={{ padding: '10px 14px', fontSize: 11.5, color: THEME.textMuted }}>
                            {[
                                { label: 'Indexes loaded', val: indexes.length, color: THEME.textMain },
                                { label: 'Slow queries',   val: slowQueries.length, color: slowQueries.length > 0 ? THEME.warning : THEME.textMain },
                                { label: 'Active locks',   val: locks.length, color: locks.length > 0 ? THEME.danger : THEME.success },
                                { label: 'Param issues',   val: paramIssues.length, color: paramIssues.length > 0 ? THEME.warning : THEME.textMain },
                            ].map((row, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                    <span>{row.label}</span>
                                    <b style={{ color: row.color, fontVariantNumeric: 'tabular-nums' }}>{loading ? '…' : row.val}</b>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* COMMAND PALETTE overlay */}
            {paletteOpen && (
                <div onClick={() => setPaletteOpen(false)}
                     style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,16,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 96, zIndex: 9000 }}>
                    <div onClick={e => e.stopPropagation()} className="opt-card"
                         style={{ width: 'min(640px, 92vw)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.45)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${THEME.glassBorder}` }}>
                            <Search size={16} color={THEME.textMuted} />
                            <input
                                ref={paletteInputRef}
                                value={paletteQuery}
                                onChange={e => { setPaletteQuery(e.target.value); setPaletteIndex(0); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteIndex(i => Math.min(paletteResults.length - 1, i + 1)); }
                                    else if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteIndex(i => Math.max(0, i - 1)); }
                                    else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const sel = paletteResults[paletteIndex];
                                        if (sel) openCell(sel.id);
                                    }
                                }}
                                placeholder="Search tools, queries, or actions…"
                                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: THEME.textMain, fontSize: 15 }}
                            />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: THEME.textDim, padding: '3px 7px', borderRadius: 6, background: `${THEME.grid}40`, border: `1px solid ${THEME.grid}` }}>esc</span>
                        </div>
                        <div className="opt-scroll" style={{ maxHeight: 380, overflowY: 'auto', padding: '6px 0' }}>
                            {['Plan', 'Advisors', 'Inspect', 'Tune'].map(group => {
                                const inGroup = paletteResults.filter(t => t.group === group);
                                if (inGroup.length === 0) return null;
                                return (
                                    <React.Fragment key={group}>
                                        <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, color: THEME.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group}</div>
                                        {inGroup.map(t => {
                                            const idx = paletteResults.indexOf(t);
                                            const sel = idx === paletteIndex;
                                            return (
                                                <div key={t.id} onClick={() => openCell(t.id)} onMouseEnter={() => setPaletteIndex(idx)}
                                                     style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', cursor: 'pointer', background: sel ? `${THEME.primary}12` : 'transparent' }}>
                                                    <span style={{ width: 28, height: 28, borderRadius: 7, background: sel ? `${THEME.primary}20` : `${THEME.grid}40`, color: sel ? THEME.primary : THEME.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <t.icon size={14} />
                                                    </span>
                                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 500, color: THEME.textMain }}>{t.label}</span>
                                                        <span style={{ fontSize: 11, color: THEME.textDim }}>· {t.hint}</span>
                                                        {t.isNew && <span style={{ fontSize: 8.5, padding: '1px 5px', borderRadius: 4, background: `${THEME.primary}25`, color: THEME.primary, fontWeight: 800, letterSpacing: '0.04em' }}>NEW</span>}
                                                    </div>
                                                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5, color: THEME.textDim }}>{t.kbd}</span>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                            {paletteResults.length === 0 && (
                                <div style={{ padding: 28, textAlign: 'center', color: THEME.textDim, fontSize: 12 }}>No tools match &ldquo;{paletteQuery}&rdquo;</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(QueryOptimizerTab);
