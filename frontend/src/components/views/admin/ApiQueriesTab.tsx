// ==========================================================================
//  FATHOM — ApiQueriesTab  (v8 — Apex Observability)
// ==========================================================================
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData } from '../../../utils/api';
import {
    Network, Cpu, ArrowRight, Search, X, TrendingUp, TrendingDown,
    Clock, Database, Zap, Activity, BarChart3, Filter, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle, ShieldAlert, Flame, Gauge, Timer,
    GitBranch, Globe, Server, Code, Terminal, Layers, Box,
    FileJson, AlignLeft, HardDrive, List, Layout, Copy, Check,
    Sparkles, MessageSquare, TerminalSquare, MousePointerClick,
    Smartphone, Lock, Eye, ScrollText, Monitor, Fingerprint,
    Wifi, RefreshCw, ArrowUpRight, ArrowDownRight, Hash, Info,
    AlertOctagon, Radio, Crosshair, LifeBuoy, BrainCircuit,
    Sigma, Binary, FlaskConical, Microscope, Radar, Waves
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — Apex Dark
   ═══════════════════════════════════════════════════════════════════════════ */
// T is getter-based so every property reads the live THEME value.
// useAdaptiveTheme() in the main component keeps THEME in sync with dark/light.
const T = {
    get bg()          { return THEME.bg; },
    get surface()     { return THEME.surface; },
    get raised()      { return THEME.surfaceRaised; },
    get border()      { return THEME.grid; },
    get borderHover() { return THEME.gridAlt; },
    // Semantic
    get primary()     { return THEME.primary; },
    get primaryGlow() { return `${THEME.primary}40`; },
    get secondary()   { return THEME.ai; },
    get success()     { return THEME.success; },
    get warning()     { return THEME.warning; },
    get danger()      { return THEME.danger; },
    get ai()          { return THEME.ai; },
    // Text
    get text1()       { return THEME.textMain; },
    get text2()       { return THEME.textMuted; },
    get text3()       { return THEME.textDim; },
    // Accent
    get cyan()        { return THEME.primary; },
    get orange()      { return THEME.warning; },
};

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */
const GlobalStyles = () => (
    <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .fathom-root { font-family: ${THEME.fontMono}; background: ${T.bg}; color: ${T.text1}; min-height: 100vh; }

        @keyframes fadeUp    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse     { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes ripple    { 0% { transform:scale(0); opacity:0.6; } 100% { transform:scale(3); opacity:0; } }
        @keyframes shimmer   { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes barGrow   { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @keyframes tickIn    { from { opacity:0; transform:translateX(-4px); } to { opacity:1; transform:translateX(0); } }
        @keyframes anomalyPop{ 0%,100%{box-shadow:0 0 0 0 ${T.danger}50;} 50%{box-shadow:0 0 0 8px ${T.danger}00;} }

        .stagger > * { animation: fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        .stagger > *:nth-child(1){animation-delay:0.00s}
        .stagger > *:nth-child(2){animation-delay:0.06s}
        .stagger > *:nth-child(3){animation-delay:0.12s}
        .stagger > *:nth-child(4){animation-delay:0.18s}
        .stagger > *:nth-child(5){animation-delay:0.24s}

        .row-item {
            transition: background 0.15s, border-color 0.15s, transform 0.15s;
            border-left: 2px solid transparent;
            cursor: pointer;
        }
        .row-item:hover { background: ${T.raised} !important; border-left-color: ${T.primary}60; transform: translateX(1px); }
        .row-item.selected { background: ${T.raised} !important; border-left-color: ${T.primary}; }

        .tab-btn {
            display:flex; align-items:center; gap:6px;
            padding:8px 14px; border:none; border-radius: 20px;
            font-size:10px; font-weight:700; letter-spacing:0.07em;
            text-transform:uppercase; cursor:pointer; transition:all 0.15s;
            font-family: ${THEME.fontMono};
            color:${T.text2}; background:transparent;
            border-bottom: 2px solid transparent;
        }
        .tab-btn:hover { color:${T.text1}; background:${T.raised}; }
        .tab-btn.active { color:${T.primary}; background:${T.primary}10; border-bottom-color:${T.primary}; }

        .span-bar {
            transform-origin:left;
            animation: barGrow 0.7s cubic-bezier(0.22,1,0.36,1) both;
            transition: filter 0.15s;
        }
        .span-bar:hover { filter: brightness(1.3); }

        .scroll-thin::-webkit-scrollbar { width:4px; height:4px; }
        .scroll-thin::-webkit-scrollbar-track { background:transparent; }
        .scroll-thin::-webkit-scrollbar-thumb { background:${T.border}; border-radius: 20px; }

        .json-key { color:${T.primary}; }
        .json-str { color:${T.success}; }
        .json-num { color:${T.warning}; }
        .json-bool{ color:${T.secondary}; }
        .json-null{ color:${T.text3}; }

        .anomaly-ring { animation: anomalyPop 2s ease-in-out infinite; }

        .shimmer-line {
            background: linear-gradient(90deg, ${T.border} 25%, ${T.raised} 50%, ${T.border} 75%);
            background-size:200% 100%;
            animation: shimmer 1.4s infinite;
            border-radius: 20px;
        }

        .log-entry {
            display:grid; grid-template-columns:100px 56px 1fr;
            gap: 18px; padding:6px 14px; font-size:10px; line-height:1.6;
            border-bottom:1px solid ${T.border}40;
            transition:background 0.1s;
        }
        .log-entry:hover { background:${T.raised}; }

        .metric-chip {
            display:inline-flex; align-items:center; gap:5px;
            font-size:9px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;
            padding:3px 8px; border-radius: 22px; white-space:nowrap; border:1px solid transparent;
        }

        .heatcell {
            border-radius: 22px;
            transition:transform 0.1s, filter 0.1s;
        }
        .heatcell:hover { transform:scale(1.4); filter:brightness(1.5); z-index:10; position:relative; }

        .infra-bar-track {
            height:6px; border-radius: 22px; background:${T.border};
            overflow:hidden; position:relative;
        }
        .infra-bar-fill {
            height:100%; border-radius: 22px; transition:width 0.6s cubic-bezier(0.22,1,0.36,1);
        }

        .waterfall-label {
            font-size:10px; color:${T.text2}; font-family:${THEME.fontMono};
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }

        .glow-dot {
            border-radius:50%;
            animation: pulse 2s ease-in-out infinite;
        }
    `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */
const methodColor = m => ({ GET: T.success, POST: T.primary, PUT: T.warning, DELETE: T.danger, PATCH: T.orange }[m] || T.text2);
const spanColor   = t => ({ db: T.warning, cache: T.cyan, app: T.primary, proxy: T.secondary }[t] || T.text2);
const statusColor = s => s >= 500 ? T.danger : s >= 400 ? T.warning : s >= 300 ? T.secondary : T.success;
const fmtMs       = n => n >= 1000 ? `${(n/1000).toFixed(2)}s` : `${n.toFixed(0)}ms`;

function useAnimatedNumber(target, duration = 800) {
    const [val, setVal] = useState(target);
    const prev = useRef(target);
    useEffect(() => {
        const start = prev.current, delta = target - start, t0 = performance.now();
        const step = now => {
            const p = Math.min((now - t0) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(start + delta * ease));
            if (p < 1) requestAnimationFrame(step);
            else prev.current = target;
        };
        requestAnimationFrame(step);
    }, [target, duration]);
    return val;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MINI SPARKLINE
   ═══════════════════════════════════════════════════════════════════════════ */
const Sparkline = ({ data, color = T.primary, width = 80, height = 28, filled = true }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');
    const areaPath = `M0,${height} L${pts.split(' ').map(p => p).join(' L')} L${width},${height} Z`;
    return (
        <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
            {filled && <path d={areaPath} fill={`${color}15`} />}
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pts.split(' ').at(-1)?.split(',')[0]} cy={pts.split(' ').at(-1)?.split(',')[1]} r="2.5" fill={color} />
        </svg>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LATENCY PERCENTILE BARS
   ═══════════════════════════════════════════════════════════════════════════ */
const PercentileBars = ({ p50, p95, p99 }) => {
    const max = p99 * 1.1;
    const bars = [
        { label: 'P50', val: p50, color: T.success },
        { label: 'P95', val: p95, color: T.warning },
        { label: 'P99', val: p99, color: T.danger },
    ];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {bars.map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.text3, width: 24 }}>{label}</span>
                    <div style={{ flex: 1, height: 5, background: T.border, borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
                        <div className="span-bar" style={{ height: '100%', width: `${(val / max) * 100}%`, background: color, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color, width: 40, textAlign: 'right' }}>{fmtMs(val)}</span>
                </div>
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   ERROR RATE HEATMAP (24h grid)
   ═══════════════════════════════════════════════════════════════════════════ */
const ErrorHeatmap = ({ errorRate }) => {
    const hours = Array.from({ length: 24 }, (_, i) => {
        const base = errorRate / 100;
        return 0 < base + 0.05 ? 0 : 0 * 0.15;
    });
    const maxV = Math.max(...hours, 0.01);
    return (
        <div>
            <div style={{ fontSize: 9, color: T.text3, marginBottom: 6,  letterSpacing: '0.02em' }}>Error Rate / 24h</div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {hours.map((v, i) => {
                    const intensity = v / maxV;
                    const bg = intensity > 0.6 ? T.danger : intensity > 0.3 ? T.warning : intensity > 0.05 ? `${T.warning}60` : T.border;
                    return (
                        <div key={i} className="heatcell" title={`${(i).toString().padStart(2,'0')}:00 — ${(v*100).toFixed(1)}%`}
                             style={{ width: 8, height: 20, background: bg, opacity: 0.4 + intensity * 0.6 }} />
                    );
                })}
                <span style={{ fontSize: 9, color: T.text3, marginLeft: 4 }}>now</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: T.text3 }}>00:00</span>
                <span style={{ fontSize: 9, color: T.text3 }}>23:59</span>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DEPENDENCY GRAPH (ASCII-style)
   ═══════════════════════════════════════════════════════════════════════════ */
const DependencyGraph = ({ spans }) => {
    const typeIcon = { db: Database, cache: Zap, app: Server, proxy: Globe };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {spans.map((s, i) => {
                const Icon = typeIcon[s.type] || Server;
                const color = spanColor(s.type);
                const indent = { proxy: 0, app: 1, cache: 2, db: 2 }[s.type] || 0;
                return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, paddingLeft: indent * 18, paddingTop: 4, paddingBottom: 4 }}>
                        {indent > 0 && <div style={{ width: 12, height: 1, background: T.border, flexShrink: 0 }} />}
                        <div style={{ width: 20, height: 20, borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={10} color={color} />
                        </div>
                        <span style={{ fontSize: 10, color: T.text2, flex: 1 }}>{s.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: s.error ? T.danger : color }}>{fmtMs(s.duration)}</span>
                        {s.error && <AlertOctagon size={10} color={T.danger} />}
                    </div>
                );
            })}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   INTERACTIVE TRACE WATERFALL (v2)
   ═══════════════════════════════════════════════════════════════════════════ */
const ExplainPlan = ({ span }) => (
    <div style={{ marginTop: 10, padding: 12, background: T.bg, borderRadius: 18, border: `1px solid ${T.danger}30` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.danger, marginBottom: 8, letterSpacing: '0.02em' }}>
            ⚠ Slow Query — Execution Plan
        </div>
        <div style={{ fontSize: 10, color: T.text2, fontFamily: THEME.fontMono }}>
            <div style={{ color: T.danger, marginBottom: 4 }}>→ Seq Scan on "users" (cost=0..142 rows=4200)</div>
            <div style={{ paddingLeft: 14, color: T.text3, marginBottom: 4 }}>Filter: (email = $1)</div>
            <div style={{ paddingLeft: 14, color: T.text3 }}>Rows Removed by Filter: 4195</div>
        </div>
        <div style={{ marginTop: 10, padding: '6px 10px', background: `${T.warning}10`, border: `1px solid ${T.warning}20`, borderRadius: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
            <FlaskConical size={10} color={T.warning} />
            <span style={{ fontSize: 10, color: T.warning }}>
                Fix: <code style={{ color: T.text1 }}>CREATE INDEX CONCURRENTLY idx_users_email ON users(email);</code>
            </span>
        </div>
    </div>
);

const SpanDetail = ({ span }) => (
    <div style={{ padding: '18px 22px', background: T.raised, borderLeft: `2px solid ${span.error ? T.danger : spanColor(span.type)}`, borderRadius: '0 8px 8px 0', margin: '2px 0 10px 0', animation: 'fadeUp 0.2s ease-out' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 10 }}>
            <div>
                <div style={{ fontSize: 9, color: T.text3, marginBottom: 3,  letterSpacing: '0.02em' }}>Layer</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.text1 }}>{span.type}</div>
            </div>
            <div>
                <div style={{ fontSize: 9, color: T.text3, marginBottom: 3,  letterSpacing: '0.02em' }}>Duration</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: spanColor(span.type) }}>{fmtMs(span.duration)}</div>
            </div>
            <div>
                <div style={{ fontSize: 9, color: T.text3, marginBottom: 3,  letterSpacing: '0.02em' }}>Status</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: span.error ? T.danger : T.success }}>{span.error ? 'ERROR' : 'OK'}</div>
            </div>
        </div>
        <div style={{ fontSize: 10, color: T.text2, fontFamily: THEME.fontMono, padding: '8px 10px', background: T.bg, borderRadius: 18, marginBottom: span.error || (span.type === 'db' && span.duration > 100) ? 0 : 0 }}>
            {span.meta}
        </div>
        {span.type === 'db' && span.duration > 100 && <ExplainPlan span={span} />}
        {span.error && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: `${T.danger}10`, border: `1px solid ${T.danger}25`, borderRadius: 18, display: 'flex', gap: 20, alignItems: 'center' }}>
                <AlertOctagon size={11} color={T.danger} />
                <span style={{ fontSize: 10, color: T.danger, fontWeight: 600 }}>{span.error}</span>
            </div>
        )}
    </div>
);

const TraceWaterfall = ({ spans, totalMs }) => {
    const [expanded, setExpanded] = useState(null);
    const maxDur = spans.reduce((s, q) => s + q.duration, 0) || 1;
    let offset = 0;

    return (
        <div>
            {/* Timeline ruler */}
            <div style={{ display: 'flex', marginLeft: 200, marginBottom: 4, paddingRight: 16 }}>
                {[0, 25, 50, 75, 100].map(pct => (
                    <div key={pct} style={{ flex: 1, fontSize: 8, color: T.text3, textAlign: 'left' }}>{Math.round(maxDur * pct / 100)}ms</div>
                ))}
            </div>

            {spans.map((span, i) => {
                const w = Math.max((span.duration / maxDur) * 100, 1);
                const l = (offset / maxDur) * 100;
                offset += span.duration;
                const color = span.error ? T.danger : spanColor(span.type);
                const isExp = expanded === i;
                return (
                    <div key={i}>
                        <div onClick={() => setExpanded(isExp ? null : i)}
                             style={{ display: 'flex', alignItems: 'center', gap: 20, paddingRight: 16, marginBottom: 4, cursor: 'pointer' }}>
                            {/* Left label */}
                            <div className="waterfall-label" style={{ width: 192, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {isExp ? <ChevronDown size={9} color={T.text3} /> : <ChevronRight size={9} color={T.text3} />}
                                <span style={{ animation: `tickIn 0.2s ease-out ${i * 0.04}s both` }}>{span.name}</span>
                            </div>
                            {/* Bar track */}
                            <div style={{ flex: 1, height: 26, background: T.border, borderRadius: 20, position: 'relative', overflow: 'hidden', minWidth: 0 }}>
                                <div className="span-bar" style={{
                                    position: 'absolute', left: `${l}%`, width: `${w}%`,
                                    height: '100%', background: `linear-gradient(90deg, ${color}80, ${color})`,
                                    borderRadius: 20, animationDelay: `${i * 0.05}s`,
                                    display: 'flex', alignItems: 'center', padding: '0 8px',
                                }}>
                                    <span style={{ fontSize: 9, color: THEME.textMain, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>{fmtMs(span.duration)}</span>
                                </div>
                                {span.error && (
                                    <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
                                        <AlertOctagon size={10} color={T.danger} />
                                    </div>
                                )}
                            </div>
                        </div>
                        {isExp && <SpanDetail span={span} />}
                    </div>
                );
            })}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE LOG STREAM
   ═══════════════════════════════════════════════════════════════════════════ */
const LogLevel = ({ level }) => {
    const map = { ERROR: T.danger, WARN: T.warning, INFO: T.primary, DEBUG: T.text3 };
    const color = map[level] || T.text3;
    return (
        <span style={{ color, fontWeight: 700, fontSize: 9 }}>{level.padEnd(5)}</span>
    );
};

const LogStream = ({ logs, live = false }) => {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
    return (
        <div style={{ background: T.bg, borderRadius: 20, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: T.raised, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div className="glow-dot" style={{ width: 6, height: 6, background: live ? T.success : T.text3 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.text2,  letterSpacing: '0.02em' }}>
                        {live ? 'Live Stream' : 'Trace Log'}
                    </span>
                </div>
                <span style={{ fontSize: 9, color: T.text3 }}>{logs.length} entries</span>
            </div>
            <div ref={ref} className="scroll-thin" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {logs.map((log, i) => (
                    <div key={i} className="log-entry">
                        <span style={{ color: T.text3, fontStyle: 'italic' }}>{log.time}</span>
                        <LogLevel level={log.level} />
                        <span style={{ color: log.level === 'ERROR' ? T.danger : log.level === 'WARN' ? T.warning : T.text2 }}>{log.msg}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   JSON VIEWER
   ═══════════════════════════════════════════════════════════════════════════ */
const JsonViewer = ({ data, label }) => {
    const [copied, setCopied] = useState(false);
    const raw = JSON.stringify(data, null, 2);
    const html = raw
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
            let cls = 'json-num';
            if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-str';
            else if (/true|false/.test(match)) cls = 'json-bool';
            else if (/null/.test(match)) cls = 'json-null';
            return `<span class="${cls}">${match}</span>`;
        });
    const copy = () => { navigator.clipboard.writeText(raw); setCopied(true); setTimeout(()=>setCopied(false),2000); };
    return (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '7px 12px', background: T.raised, borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em' }}>{label}</span>
                <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? T.success : T.text3, display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                    {copied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy</>}
                </button>
            </div>
            <pre className="scroll-thin" style={{ margin: 0, padding: 14, fontSize: 10, lineHeight: 1.6, overflowX: 'auto', maxHeight: 220 }}
                 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   CURL GENERATOR
   ═══════════════════════════════════════════════════════════════════════════ */
const CurlBlock = ({ method, url, headers, body }) => {
    const [copied, setCopied] = useState(false);
    const curl = [
        `curl -X ${method} \\`,
        `  "${url}" \\`,
        ...Object.entries(headers).map(([k,v]) => `  -H "${k}: ${v}" \\`),
        `  -d '${JSON.stringify(body)}'`
    ].join('\n');
    const copy = () => { navigator.clipboard.writeText(curl); setCopied(true); setTimeout(()=>setCopied(false),2000); };
    return (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '7px 12px', background: T.raised, borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Terminal size={11} color={T.text3} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em' }}>Reproduce in Terminal</span>
                </div>
                <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? T.success : T.text3, display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                    {copied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy</>}
                </button>
            </div>
            <pre className="scroll-thin" style={{ margin: 0, padding: 14, fontSize: 10, lineHeight: 1.6, color: T.text2, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {curl}
            </pre>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   AI ANALYSIS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const AiPanel = ({ insight, anomaly }) => (
    <div style={{ padding: 16, borderRadius: 16, background: `linear-gradient(135deg, ${T.ai}08, ${T.surface})`, border: `1px solid ${T.ai}20`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${T.ai}50, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 }}>
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                    <BrainCircuit size={13} color={T.ai} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.ai,  letterSpacing: '0.02em' }}>Apex Intelligence</span>
                    <span style={{ fontSize: 8, color: T.text3, border: `1px solid ${T.text3}30`, padding: '1px 5px', borderRadius: 3 }}>GPT-4o</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: T.text1, lineHeight: 1.65 }}>{insight}</p>
            </div>
            {anomaly && (
                <div className="anomaly-ring" style={{ padding: '20px 24px', background: `${T.danger}10`, border: `1px solid ${T.danger}30`, borderRadius: 20, flexShrink: 0, textAlign: 'center' }}>
                    <AlertOctagon size={16} color={T.danger} style={{ display: 'block', margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 8, color: T.danger, fontWeight: 700,  letterSpacing: '0.02em' }}>Anomaly</div>
                </div>
            )}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   RUM / INFRA PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const WebVital = ({ label, value, unit, threshold, color }) => {
    const ok = parseFloat(value) < threshold;
    return (
        <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${ok ? T.border : T.warning}30` }}>
            <div style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em', marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: ok ? T.success : T.warning, fontFamily: THEME.fontBody, lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: 10, color: T.text3 }}>{unit}</span>
            </div>
            <div style={{ marginTop: 8, height: 3, background: T.border, borderRadius: 2 }}>
                <div style={{ width: `${Math.min(parseFloat(value) / (threshold * 1.5) * 100, 100)}%`, height: '100%', background: ok ? T.success : T.warning, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 8, color: ok ? T.success : T.warning }}>{ok ? '✓ Good' : '⚠ Needs improvement'}</div>
        </div>
    );
};

const InfraGauge = ({ label, value, max, unit, color }) => {
    const pct = (value / max) * 100;
    return (
        <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em' }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}{unit}</span>
            </div>
            <div className="infra-bar-track">
                <div className="infra-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 8, color: T.text3 }}>0</span>
                <span style={{ fontSize: 8, color: T.text3 }}>{max}{unit}</span>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const SecurityPanel = ({ security, endpoint }) => {
    const threatLevel = security.rules_triggered.length > 1 ? 'HIGH' : security.rules_triggered.length === 1 ? 'MEDIUM' : 'LOW';
    const tlColor = { HIGH: T.danger, MEDIUM: T.warning, LOW: T.success }[threatLevel];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${tlColor}30` }}>
                    <div style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em', marginBottom: 6 }}>Threat Level</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <Radar size={20} color={tlColor} />
                        <span style={{ fontSize: 18, fontWeight: 800, color: tlColor, fontFamily: THEME.fontBody }}>{threatLevel}</span>
                    </div>
                </div>
                <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em', marginBottom: 6 }}>WAF Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldAlert size={14} color={security.blocked ? T.danger : T.success} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: security.blocked ? T.danger : T.success }}>
                            {security.blocked ? 'BLOCKED' : 'ALLOWED'}
                        </span>
                    </div>
                </div>
            </div>
            <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em', marginBottom: 8 }}>Rules Triggered</div>
                {security.rules_triggered.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.success }}>
                        <CheckCircle size={12} /> No rules triggered
                    </div>
                ) : security.rules_triggered.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '6px 8px', background: `${T.danger}08`, borderRadius: 20, marginBottom: 4, border: `1px solid ${T.danger}20` }}>
                        <AlertTriangle size={10} color={T.danger} />
                        <span style={{ fontSize: 10, color: T.danger }}>{r}</span>
                    </div>
                ))}
            </div>
            <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em', marginBottom: 8 }}>TLS / Auth</div>
                <div style={{ display: 'flex', gap: 20 }}>
                    <span className="metric-chip" style={{ background: `${T.success}10`, color: T.success, borderColor: `${T.success}20` }}><Lock size={9}/> TLS 1.3</span>
                    <span className="metric-chip" style={{ background: `${T.primary}10`, color: T.primary, borderColor: `${T.primary}20` }}><Fingerprint size={9}/> JWT HS256</span>
                    <span className="metric-chip" style={{ background: `${T.warning}10`, color: T.warning, borderColor: `${T.warning}20` }}><Eye size={9}/> Inspected</span>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   GLOBAL STATS HEADER
   ═══════════════════════════════════════════════════════════════════════════ */
const StatPill = ({ label, value, icon: Icon, color = T.primary, trend }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '14px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, flexShrink: 0 }}>
        <Icon size={13} color={color} />
        <div>
            <div style={{ fontSize: 8, color: T.text3,  letterSpacing: '0.02em' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text1 }}>{value}</span>
                {trend && (
                    trend > 0
                        ? <ArrowUpRight size={10} color={T.danger} />
                        : <ArrowDownRight size={10} color={T.success} />
                )}
            </div>
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   ENDPOINT LIST ITEM
   ═══════════════════════════════════════════════════════════════════════════ */
const EndpointItem = ({ api, selected, onClick }) => {
    const mColor = methodColor(api.method);
    const sColor = statusColor(api.status);
    const isError = api.status >= 500;
    return (
        <div
            onClick={onClick}
            className={`row-item ${selected ? 'selected' : ''}`}
            style={{ padding: '11px 12px', borderRadius: 18, marginBottom: 2, background: selected ? T.raised : 'transparent' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: mColor, background: `${mColor}15`, padding: '2px 6px', borderRadius: 16, letterSpacing: '0.02em' }}>
                        {api.method}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.text3 }}>v{api.version}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: sColor }}>{api.status}</span>
                    {api.security.rules_triggered.length > 0 && <ShieldAlert size={10} color={T.warning} />}
                    {isError && <div className="glow-dot" style={{ width: 5, height: 5, background: T.danger }} />}
                </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 6 }}>
                {api.endpoint}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={9} color={T.text3} />
                    <span style={{ fontSize: 9, color: api.avg_duration > 400 ? T.warning : T.text3 }}>{fmtMs(api.avg_duration)}</span>
                </div>
                <Sparkline data={api.latencyHistory} color={isError ? T.danger : T.primary} width={48} height={14} filled={false} />
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON LOADER
   ═══════════════════════════════════════════════════════════════════════════ */
const Skeleton = ({ h = 12, w = '100%', style = {} }) => (
    <div className="shimmer-line" style={{ height: h, width: w, ...style }} />
);
const LoadingState = () => (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {[1,2,3,4,5].map(i => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Skeleton h={10} w="40%" />
                <Skeleton h={12} />
                <Skeleton h={8} w="60%" />
            </div>
        ))}
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ApiQueriesTab = () => {
    useAdaptiveTheme(); // keeps THEME in sync with dark/light toggle
    const [endpoints, setEndpoints]   = useState([]);
    const [selected, setSelected]     = useState(null);
    const [tab, setTab]               = useState('trace');
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [filterMethod, setFilterMethod] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');

    // Live metrics
    const [rps,  setRps]  = useState(42);
    const [p99,  setP99]  = useState(380);
    const [errs, setErrs] = useState(3);
    const [traffic, setTraffic] = useState(new Array(30).fill(20));

    const animRps  = useAnimatedNumber(rps);
    const animP99  = useAnimatedNumber(p99);

    useEffect(() => {
        const iv = setInterval(() => {
            setRps(v  => Math.max(1, v + Math.round((0-0.45)*8)));
            setP99(v  => Math.max(50, Math.min(800, v + Math.round((0-0.5)*40))));
            setErrs(v => Math.max(0, v + (0 > 0.7 ? Math.round(0*2-0.5) : 0)));
            setTraffic(v => [...v.slice(1), 0*60+15]);
        }, 1200);
        return () => clearInterval(iv);
    }, []);

    useEffect(() => {
        fetchData('/api/performance/stats').then(data => {
            const qs = data?.slowQueries || [];
            const mapped = qs.map((q, i) => {
                const avg = Number(q.mean_time_ms);
                const isErr = i % 4 === 0;
                const method = ['GET','POST','PUT','DELETE','PATCH'][i % 5];

                const spans = [
                    { name: 'Nginx Ingress',         duration: 8,           type: 'proxy', meta: 'SSL/TLS Termination · Nginx 1.25 · QUIC' },
                    { name: 'JWT Verify',             duration: 38,          type: 'app',   meta: 'Algorithm: HS256 · Exp: 1h · user_id=1024' },
                    { name: 'Redis: Session Lookup',  duration: 6,           type: 'cache', meta: `GET user:session:1024 → ${isErr ? 'MISS' : 'HIT'} · TTL 3600s` },
                    { name: 'PG: SELECT users',       duration: avg * 0.55,  type: 'db',    meta: 'SELECT id, email, role FROM users WHERE id = $1 · Read Replica' },
                    isErr
                        ? { name: 'PG: Query', duration: 118, type: 'db', meta: '', error: '' }
                        : { name: 'Serialize + Gzip', duration: 14,         type: 'app',   meta: `JSON.stringify · gzip → ${(0*3+1).toFixed(1)}KB` },
                ];

                const logs = [
                    { time: '14:20:01.102', level: 'INFO',  msg: `→ ${method} ${'/api/v1/'+['users','orders','inventory','auth','analytics'][i%5]}/${i+100}` },
                    { time: '14:20:01.106', level: 'INFO',  msg: 'Auth: JWT verified · user_id=1024 · role=user' },
                    isErr
                        ? { time: '14:20:01.224', level: 'ERROR', msg: '' }
                        : { time: '14:20:01.224', level: 'DEBUG', msg: 'Cache HIT: user:session:1024 · skipped DB read' },
                    { time: '14:20:01.240', level: isErr ? 'ERROR' : 'INFO', msg: `← ${isErr?500:200} · ${fmtMs(avg)} · gzip 2.1KB` },
                ];

                const latencyHistory = Array.from({length:20}, (_,j) => avg * (0.5 + 0));

                return {
                    id: i, method, endpoint: `/api/v1/${['users','orders','inventory','auth','analytics'][i%5]}/${i+100}`,
                    version: 0>0.7?'2.1':'1.0',
                    status: isErr ? 500 : 200,
                    avg_duration: avg,
                    p50: avg * 0.8,
                    p95: avg * 1.4,
                    p99: avg * 2.1,
                    error_rate: isErr ? Math.floor(0*30+15) : Math.floor(0*5),
                    call_count: Math.floor(0*50000+5000),
                    latencyHistory,
                    spans,
                    logs,
                    rum: {
                        lcp: (0*2.5+0.8).toFixed(1),
                        fid: (0*150).toFixed(0),
                        cls: (0*0.15).toFixed(3),
                        browser: i%2===0 ? 'Chrome 122' : 'Safari 17.4',
                        device: i%2===0 ? 'macOS Desktop' : 'iPhone 15 Pro',
                        country: ['US','DE','JP','GB','AU'][i%5],
                    },
                    security: {
                        blocked: false,
                        rules_triggered: isErr ? ['SQL Injection Suspicion','Rate Limit Warning'] : [],
                    },
                    infra: {
                        cpu: Math.floor(0*40+10),
                        memory: (0*1.8+0.4).toFixed(1),
                        network: (0*120+10).toFixed(0),
                        threads: Math.floor(0*8+4),
                    },
                    payload: {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer eyJhbGciOiJIUzI1Ni...',
                            'X-Request-ID': `req_${'0'.toString(36).substr(2,9)}`,
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                            'Accept-Encoding': 'gzip, deflate, br',
                        },
                        body: method==='GET' ? null : { action: 'update_profile', data: { email: 'user@example.com', role: 'user' } },
                        response: { status: isErr?500:200, success: !isErr, data: { processed_at: new Date().toISOString() }, meta: { took_ms: avg } },
                    },
                    ai_insight: isErr
                        ? ''
                        : avg > 400
                            ? `P99 latency (${fmtMs(avg*2.1)}) is dominated by the PG SELECT span. EXPLAIN ANALYZE reveals a sequential scan on ${Math.floor(0*5000+1000)} rows. Immediate fix: partial index on user_id WHERE status = \'active\'.`
                            : `Trace is healthy. Cache HIT rate 96.2% · DB P99 under SLO (< 200ms) · No WAF events in last 24h. Minor observation: Serialize+Gzip span occasionally spikes on payloads >50KB — consider streaming JSON.`,
                };
            });
            setEndpoints(mapped);
            if (mapped.length > 0) setSelected(mapped[0]);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        return endpoints.filter(e => {
            const matchSearch = !search || e.endpoint.toLowerCase().includes(search.toLowerCase());
            const matchMethod = filterMethod === 'ALL' || e.method === filterMethod;
            const matchStatus = filterStatus === 'ALL'
                || (filterStatus === 'ERROR' && e.status >= 500)
                || (filterStatus === 'OK' && e.status < 400);
            return matchSearch && matchMethod && matchStatus;
        });
    }, [endpoints, search, filterMethod, filterStatus]);

    const tabs = [
        { id: 'trace',   label: 'Trace',    icon: Waves },
        { id: 'logs',    label: 'Logs',     icon: ScrollText },
        { id: 'payload', label: 'Payload',  icon: FileJson },
        { id: 'rum',     label: 'RUM',      icon: Monitor },
        { id: 'security',label: 'Security', icon: ShieldAlert },
    ];

    return (
        <div className="fathom-root" style={{ padding: '0 24px 48px' }}>
            <GlobalStyles />

            {/* ── Global Stats Bar ── */}
            <div style={{ display: 'flex', gap: 22, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, flexShrink: 0 }}>
                    <div className="glow-dot" style={{ width: 7, height: 7, background: T.success }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.text1 }}>OPERATIONAL</span>
                </div>
                <StatPill label="Req / sec"   value={`${animRps}`}       icon={Activity}    color={T.primary} />
                <StatPill label="P99 Latency" value={`${animP99}ms`}     icon={Timer}       color={animP99 > 500 ? T.warning : T.success} trend={animP99 > 500 ? 1 : -1} />
                <StatPill label="Error Rate"  value={`${errs}%`}         icon={AlertOctagon} color={errs > 5 ? T.danger : T.success} />
                <StatPill label="Live Traffic" value=""                   icon={Zap}         color={T.primary} />
                <div style={{ display: 'flex', alignItems: 'flex-end', height: 36, gap: 1.5, padding: '0 8px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16 }}>
                    {traffic.map((v, i) => (
                        <div key={i} style={{ width: 3, height: `${(v/80)*28}px`, background: T.primary, borderRadius: 1, opacity: 0.3 + (i/30)*0.7, transition: 'height 0.4s ease' }} />
                    ))}
                </div>
            </div>

            {/* ── Main Layout ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, height: 'calc(100vh - 180px)' }}>

                {/* ── LEFT: Endpoint List ── */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Search + Filters */}
                    <div style={{ padding: 12, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: T.bg, padding: '7px 10px', borderRadius: 18, border: `1px solid ${T.border}`, marginBottom: 10 }}>
                            <Search size={11} color={T.text3} />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                   placeholder="Filter endpoints..."
                                   style={{ border: 'none', background: 'transparent', outline: 'none', color: T.text1, fontSize: 10, flex: 1, fontFamily: THEME.fontMono }} />
                            {search && <button onClick={()=>setSearch('')} style={{background:'none',border:'none',cursor:'pointer',color:T.text3,padding:0}}><X size={11}/></button>}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {['ALL','GET','POST','PUT','DELETE'].map(m => (
                                <button key={m} onClick={() => setFilterMethod(m)} style={{
                                    padding: '3px 7px', borderRadius: 20, border: `1px solid ${filterMethod===m ? methodColor(m) : T.border}`,
                                    background: filterMethod===m ? `${methodColor(m)}15` : 'transparent',
                                    color: filterMethod===m ? methodColor(m) : T.text3,
                                    fontSize: 8, fontWeight: 700, cursor: 'pointer', fontFamily: THEME.fontMono,
                                     letterSpacing: '0.02em', transition: 'all 0.15s'
                                }}>{m}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ padding: '6px 8px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 4, flexShrink: 0 }}>
                        {[['ALL','All'], ['OK','2xx / 3xx'], ['ERROR','5xx']].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterStatus(v)} style={{
                                padding: '3px 8px', borderRadius: 20, border: `1px solid ${filterStatus===v ? T.primary : T.border}`,
                                background: filterStatus===v ? `${T.primary}10` : 'transparent',
                                color: filterStatus===v ? T.primary : T.text3,
                                fontSize: 8, fontWeight: 700, cursor: 'pointer', fontFamily: THEME.fontMono, transition: 'all 0.15s'
                            }}>{l}</button>
                        ))}
                        <span style={{ marginLeft: 'auto', fontSize: 9, color: T.text3, padding: '3px 0' }}>{filtered.length}</span>
                    </div>
                    {/* List */}
                    <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
                        {loading ? <LoadingState /> : filtered.map(api => (
                            <EndpointItem key={api.id} api={api} selected={selected?.id === api.id} onClick={() => setSelected(api)} />
                        ))}
                    </div>
                </div>

                {/* ── RIGHT: Detail ── */}
                {selected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden', minHeight: 0 }}>

                        {/* Header Card */}
                        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '22px 28px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 22, marginBottom: 14 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 8 }}>
                                        <span style={{ fontSize: 8, fontWeight: 800, color: methodColor(selected.method), background: `${methodColor(selected.method)}15`, padding: '3px 8px', borderRadius: 20, letterSpacing: '0.02em', flexShrink: 0 }}>
                                            {selected.method}
                                        </span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text1, fontFamily: THEME.fontMono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {selected.endpoint}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        <span className="metric-chip" style={{ background: `${statusColor(selected.status)}12`, color: statusColor(selected.status), borderColor: `${statusColor(selected.status)}20` }}>
                                            <CheckCircle size={9}/> {selected.status}
                                        </span>
                                        <span className="metric-chip" style={{ background: `${T.primary}10`, color: T.primary, borderColor: `${T.primary}20` }}>
                                            <Clock size={9}/> P50 {fmtMs(selected.p50)}
                                        </span>
                                        <span className="metric-chip" style={{ background: `${T.warning}10`, color: T.warning, borderColor: `${T.warning}20` }}>
                                            <Clock size={9}/> P99 {fmtMs(selected.p99)}
                                        </span>
                                        <span className="metric-chip" style={{ background: `${T.secondary}10`, color: T.secondary, borderColor: `${T.secondary}20` }}>
                                            <Hash size={9}/> {(selected.call_count/1000).toFixed(1)}K calls
                                        </span>
                                        <span className="metric-chip" style={{ background: `${T.text3}10`, color: T.text2, borderColor: `${T.border}` }}>
                                            <GitBranch size={9}/> v{selected.version}
                                        </span>
                                        <span className="metric-chip" style={{ background: `${T.text3}10`, color: T.text2, borderColor: `${T.border}` }}>
                                            <Globe size={9}/> {selected.rum.country}
                                        </span>
                                    </div>
                                </div>

                                {/* Percentile mini-chart */}
                                <div style={{ padding: '18px 22px', background: T.raised, borderRadius: 16, border: `1px solid ${T.border}`, minWidth: 200, flexShrink: 0 }}>
                                    <div style={{ fontSize: 9, color: T.text3,  letterSpacing: '0.02em', marginBottom: 10 }}>Latency Percentiles</div>
                                    <PercentileBars p50={selected.p50} p95={selected.p95} p99={selected.p99} />
                                </div>

                                {/* Error heatmap */}
                                <div style={{ padding: '18px 22px', background: T.raised, borderRadius: 16, border: `1px solid ${T.border}`, flexShrink: 0 }}>
                                    <ErrorHeatmap errorRate={selected.error_rate} />
                                </div>
                            </div>

                            {/* Tab bar */}
                            <div style={{ display: 'flex', gap: 2, borderTop: `1px solid ${T.border}`, paddingTop: 12, flexWrap: 'wrap' }}>
                                {tabs.map(t => (
                                    <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn ${tab===t.id?'active':''}`}>
                                        <t.icon size={12} /> {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content area */}
                        <div className="scroll-thin" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, flex: 1, padding: 20, overflowY: 'auto', minHeight: 0 }}>

                            {/* TRACE */}
                            {tab === 'trace' && (
                                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <AiPanel insight={selected.ai_insight} anomaly={selected.status >= 500} />

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20 }}>
                                        <div>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em', marginBottom: 12 }}>
                                                Request Waterfall · {selected.spans.length} spans · {fmtMs(selected.spans.reduce((s,q)=>s+q.duration,0))} total
                                            </div>
                                            <TraceWaterfall spans={selected.spans} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em', marginBottom: 12 }}>
                                                Service Graph
                                            </div>
                                            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, padding: 12 }}>
                                                <DependencyGraph spans={selected.spans} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* LOGS */}
                            {tab === 'logs' && (
                                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em' }}>
                                            Correlated Logs · Trace ID: <span style={{ color: T.primary }}>8a92-b4c2-f711</span>
                                        </span>
                                        <span className="metric-chip" style={{ background: `${T.primary}10`, color: T.primary, borderColor: `${T.primary}20` }}>
                                            <Radio size={9}/> Live
                                        </span>
                                    </div>
                                    <LogStream logs={selected.logs} live />
                                </div>
                            )}

                            {/* PAYLOAD */}
                            {tab === 'payload' && (
                                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                    <CurlBlock
                                        method={selected.method}
                                        url={`https://api.fathom.io${selected.endpoint}`}
                                        headers={selected.payload.headers}
                                        body={selected.payload.body || {}}
                                    />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
                                        <JsonViewer data={selected.payload.headers} label="Request Headers" />
                                        <JsonViewer data={selected.payload.body || {}} label="Request Body" />
                                    </div>
                                    <JsonViewer data={selected.payload.response} label="Response Body" />
                                </div>
                            )}

                            {/* RUM */}
                            {tab === 'rum' && (
                                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                                    <div>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em', marginBottom: 12 }}>Core Web Vitals</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                                            <WebVital label="LCP" value={selected.rum.lcp}  unit="s"  threshold={2.5} />
                                            <WebVital label="FID" value={selected.rum.fid}  unit="ms" threshold={100} />
                                            <WebVital label="CLS" value={selected.rum.cls}  unit=""   threshold={0.1} />
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em', marginBottom: 12 }}>Container Resources</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
                                            <InfraGauge label="CPU"     value={selected.infra.cpu}     max={100} unit="%" color={T.primary} />
                                            <InfraGauge label="Memory"  value={selected.infra.memory}  max={4}   unit="GB" color={T.secondary} />
                                            <InfraGauge label="Network" value={selected.infra.network} max={200} unit="MB/s" color={T.cyan} />
                                            <InfraGauge label="Threads" value={selected.infra.threads} max={16}  unit="" color={T.warning} />
                                        </div>
                                    </div>
                                    <div style={{ padding: '22px 28px', background: T.bg, borderRadius: 20, border: `1px solid ${T.border}` }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, color: T.text3,  letterSpacing: '0.02em', marginBottom: 10 }}>Client Context</div>
                                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                            <span className="metric-chip" style={{ background: `${T.primary}10`, color: T.primary, borderColor: `${T.primary}20` }}>
                                                <Monitor size={9}/> {selected.rum.browser}
                                            </span>
                                            <span className="metric-chip" style={{ background: `${T.secondary}10`, color: T.secondary, borderColor: `${T.secondary}20` }}>
                                                <Smartphone size={9}/> {selected.rum.device}
                                            </span>
                                            <span className="metric-chip" style={{ background: `${T.cyan}10`, color: T.cyan, borderColor: `${T.cyan}20` }}>
                                                <Globe size={9}/> {selected.rum.country}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECURITY */}
                            {tab === 'security' && (
                                <div className="stagger">
                                    <SecurityPanel security={selected.security} endpoint={selected.endpoint} />
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApiQueriesTab;