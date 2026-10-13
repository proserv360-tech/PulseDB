import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import { THEME as _AT, useAdaptiveTheme } from '../../utils/theme';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    RadialBarChart,
    RadialBar,
    PolarAngleAxis,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    Tooltip,
    PieChart,
    Pie,
    CartesianGrid,
    XAxis,
    YAxis,
    ReferenceLine,
    ComposedChart,
    ScatterChart,
    Scatter,
    ZAxis,
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Terminal as TerminalIcon,
    Zap,
    Bell,
    BellOff,
    Wifi,
    WifiOff,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Eye,
    EyeOff,
    Clock,
    Star,
    StarOff,
    Tag,
    Hash,
    Database,
    HardDrive,
    Lock,
    Unlock,
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    XCircle,
    Info,
    ChevronRight,
    ChevronDown,
    Copy,
    Check,
    RefreshCw,
    Loader,
    Search,
    Filter,
    X,
    MoreVertical,
    ExternalLink,
    Activity,
    Server,
    Cpu,
    ArrowUpRight,
    ArrowDownRight,
    Layers as LayersIcon,
    GitBranch,
    Radio,
    Hexagon,
    Triangle,
    Sparkles,
    Binary,
    Braces,
    Orbit,
    Play,
    Pause,
    SkipForward,
    Volume2,
    Maximize2,
    Minimize2,
    Settings,
    User,
    Globe,
    BarChart2,
    ChevronLeft,
    ChevronUp,
    Download,
    Upload,
    Link,
    Unlink,
    Box,
    Sliders,
    Code,
    FileText,
    Folder,
    Moon,
    Sun,
    Crosshair,
    Map,
    Compass,
    Navigation,
    Power,
    Share2,
    GitMerge,
    Flag,
    Bookmark,
    Archive,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
//  LEGACY THEME EXPORT — delegates to adaptive theme from utils/theme.tsx
// ═══════════════════════════════════════════════════════════════════════════
export const THEME = _AT;

// ═══════════════════════════════════════════════════════════════════════════
//  GLOBAL CONTEXT — Theme + Alerts + State
// ═══════════════════════════════════════════════════════════════════════════
const NeuralContext = createContext({});
export const useNeural = () => useContext(NeuralContext);

export const NeuralProvider = ({ children, theme: customTheme }) => {
    const [alerts, setAlerts] = useState([]);
    const [glitchTarget, setGlitchTarget] = useState(null);
    const merged = { ...THEME, ...(customTheme || {}) };
    const pushAlert = useCallback((alert) => {
        const id = Date.now();
        setAlerts((prev) => [{ ...alert, id, ts: Date.now() }, ...prev].slice(0, 8));
        return id;
    }, []);
    const dismissAlert = useCallback((id) => setAlerts((prev) => prev.filter((a) => a.id !== id)), []);
    return (
        <NeuralContext.Provider
            value={{ theme: merged, alerts, pushAlert, dismissAlert, glitchTarget, setGlitchTarget }}
        >
            {children}
        </NeuralContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  KEYFRAMES v3 — Extended animation suite
// ═══════════════════════════════════════════════════════════════════════════
const KEYFRAMES = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --font-mono:'JetBrains Mono',monospace;
  --font-body:'Outfit',sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }

@keyframes fadeUp       { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeDown     { from{opacity:0;transform:translateY(-18px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn       { from{opacity:0} to{opacity:1} }
@keyframes scaleIn      { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
@keyframes scaleUp      { from{opacity:0;transform:scale(1.12)} to{opacity:1;transform:scale(1)} }
@keyframes slideRight   { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
@keyframes slideLeft    { from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:translateX(0)} }
@keyframes alertSlide   { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
@keyframes ping         { 75%,100%{transform:scale(2.4);opacity:0} }
@keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.38} }
@keyframes breathe      { 0%,100%{opacity:0.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
@keyframes spin         { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes spinReverse  { from{transform:rotate(360deg)} to{transform:rotate(0deg)} }
@keyframes countUp      { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes shimmer      { 0%{background-position:-600% 0} 100%{background-position:600% 0} }
@keyframes expand       { from{transform:scaleX(0);transform-origin:left} to{transform:scaleX(1);transform-origin:left} }
@keyframes bounce       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes numberFlip   { 0%{transform:rotateX(-90deg);opacity:0} 100%{transform:rotateX(0deg);opacity:1} }
@keyframes valuePulse   { 0%{color:inherit} 40%{color:#3b82f6;text-shadow:0 0 12px rgba(99,102,241,0.6)} 100%{color:inherit} }
@keyframes fadeInUp     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes cardGlow     { 0%,100%{box-shadow:0 0 0 1px rgba(99,102,241,0.1)} 50%{box-shadow:0 0 16px rgba(99,102,241,0.2)} }

/* Scrollbar styling */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.25); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.4); }

/* Selection */
::selection { background: rgba(99,102,241,0.2); color: inherit; }

/* Focus ring override */
:focus-visible { outline: 1px solid rgba(99,102,241,0.4); outline-offset: 2px; }
`;

let _injected = false;
export function injectKeyframes() {
    if (_injected || typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
    _injected = true;
}

// ═══════════════════════════════════════════════════════════════════════════
//  HOOKS — Advanced state management
// ═══════════════════════════════════════════════════════════════════════════

export function useAnimatedValue(target, duration = 900, easing = 'easeOutQuart') {
    const [display, setDisplay] = useState(target);
    const rafRef = useRef(null);
    const startRef = useRef(null);
    const fromRef = useRef(target);
    const easings = {
        easeOutQuart: (p) => 1 - Math.pow(1 - p, 4),
        easeOutElastic: (p) =>
            p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
        easeOutBounce: (p) => {
            const n1 = 7.5625,
                d1 = 2.75;
            if (p < 1 / d1) return n1 * p * p;
            else if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
            else if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
            return n1 * (p -= 2.625 / d1) * p + 0.984375;
        },
        linear: (p) => p,
    };
    const ease = easings[easing] || easings.easeOutQuart;
    useEffect(() => {
        fromRef.current = display;
        startRef.current = null;
        const animate = (ts) => {
            if (!startRef.current) startRef.current = ts;
            const p = Math.min((ts - startRef.current) / duration, 1);
            setDisplay(Math.round(fromRef.current + (target - fromRef.current) * ease(p)));
            if (p < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]);
    return display;
}

export function useCopyToClipboard(timeout = 2000) {
    const [copied, setCopied] = useState(false);
    const copy = useCallback(
        async (text) => {
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), timeout);
            } catch {}
        },
        [timeout],
    );
    return [copied, copy];
}

export function useHover() {
    const [hovered, setHovered] = useState(false);
    return [hovered, { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }];
}

export function useTypewriter(text, speed = 40, started = true) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    useEffect(() => {
        if (!started) return;
        setDisplayed('');
        setDone(false);
        let i = 0;
        const id = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(id);
                setDone(true);
            }
        }, speed);
        return () => clearInterval(id);
    }, [text, speed, started]);
    return [displayed, done];
}

export function useInterval(callback, delay) {
    const savedCallback = useRef(callback);
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);
    useEffect(() => {
        if (delay === null) return;
        const id = setInterval(() => savedCallback.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}

export function useCountdown(initial, onComplete) {
    const [count, setCount] = useState(initial);
    const [running, setRunning] = useState(false);
    useInterval(() => {
        if (!running) return;
        setCount((c) => {
            if (c <= 1) {
                setRunning(false);
                onComplete?.();
                return 0;
            }
            return c - 1;
        });
    }, 1000);
    return {
        count,
        running,
        start: () => {
            setCount(initial);
            setRunning(true);
        },
        stop: () => setRunning(false),
        reset: () => {
            setRunning(false);
            setCount(initial);
        },
    };
}

export function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DECORATIVE PRIMITIVES — Enhanced
// ═══════════════════════════════════════════════════════════════════════════

export const CornerBrackets = () => null;

export const ScanlineOverlay = () => null;

export const HexPattern = () => null;

export const GridPattern = () => null;

export const GlowOrb = () => null;

export const NoiseTexture = () => null;

export const CircuitLines = () => null;

// ═══════════════════════════════════════════════════════════════════════════
//  CHIP BADGE & TREND CHIP
// ═══════════════════════════════════════════════════════════════════════════
export const ChipBadge = ({ label, color = _AT.primary, micro = false, animated = false, dot = false }) => (
    <span
        style={{
            fontSize: micro ? 9 : 10,
            fontWeight: 600,

            letterSpacing: '0.04em',
            padding: micro ? '2px 6px' : '3px 8px',
            borderRadius: '6px',
            background: `${color}12`,
            color,
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
        }}
    >
        {dot && (
            <span
                style={{
                    width: micro ? 4 : 5,
                    height: micro ? 4 : 5,
                    borderRadius: '50%',
                    background: color,
                    display: 'inline-block',
                }}
            />
        )}
        {label}
    </span>
);

export const TrendChip = ({ value, label, size = 'default' }) => {
    const color = value > 0 ? _AT.success : value < 0 ? _AT.danger : _AT.textMuted;
    const sm = size === 'small';
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontSize: sm ? 9 : 10,
                fontWeight: 700,
                color,
                fontFamily: _AT.fontMono,
                background: `${color}10`,
                padding: sm ? '1px 5px' : '2px 7px',
                borderRadius: 2,
                border: `1px solid ${color}20`,
            }}
        >
            {value > 0 ? <ArrowUpRight size={sm ? 9 : 11} /> : value < 0 ? <ArrowDownRight size={sm ? 9 : 11} /> : null}
            {value !== 0 && `${value > 0 ? '+' : ''}${value}%`}
            {label && <span style={{ color: _AT.textDim, fontWeight: 400 }}> {label}</span>}
        </span>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  1. GLASS CARD — v3 Neural Panel
// ═══════════════════════════════════════════════════════════════════════════
export const GlassCard = ({
    children,
    title,
    subtitle,
    rightNode,
    style,
    loading,
    collapsible,
    onRefresh,
    refreshing,
    accentColor,
    variant = 'default',
    showScanlines = false,
    showHex = false,
    showGrid = false,
    corners = true,
    tag,
    glitch = false,
    draggable = false,
    onClose,
    maximizable = false,
}) => {
    useAdaptiveTheme();
    injectKeyframes();
    const [collapsed, setCollapsed] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const [hovered, hoverProps] = useHover();
    const [isDragging, setIsDragging] = useState(false);
    const [glitching, setGlitching] = useState(false);
    const accent = accentColor || _AT.primary;

    useEffect(() => {
        if (!glitch) return;
        const id = setInterval(() => {
            if (Math.random() < 0.05) {
                setGlitching(true);
                setTimeout(() => setGlitching(false), 200);
            }
        }, 3000);
        return () => clearInterval(id);
    }, [glitch]);

    const variants = {
        default: { bg: _AT.glass, border: _AT.glassBorder },
        elevated: { bg: _AT.surfaceRaised, border: _AT.glassBorderHover },
        ghost: { bg: _AT.glass, border: _AT.glassBorder },
        solid: { bg: _AT.surface, border: _AT.glassBorder },
        aurora: { bg: 'rgba(99, 102, 241, 0.04)', border: 'rgba(99,102,241,0.12)' },
        danger: { bg: 'rgba(255, 45, 120, 0.05)', border: 'rgba(255,45,120,0.15)' },
        neon: { bg: 'rgba(123, 47, 255, 0.06)', border: 'rgba(123,47,255,0.18)' },
    };
    const v = variants[variant] || variants.default;

    return (
        <div
            {...hoverProps}
            className="fathom-card glass-card"
            style={{
                background: _AT.surface,
                borderRadius: 18,
                border: `1px solid ${hovered ? accent + '35' : _AT.glassBorder}`,
                boxShadow: hovered ? `${_AT.shadowMd}, 0 0 0 1px ${accent}18` : _AT.shadowSm,
                display: 'flex',
                flexDirection: 'column',
                position: maximized ? 'fixed' : 'relative',
                inset: maximized ? 0 : undefined,
                zIndex: maximized ? 1000 : undefined,
                overflow: 'hidden',
                animation: 'fadeInUp 0.3s ease-out backwards',
                transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
                ...style,
            }}
        >
            {/* Gradient accent top line */}
            <div
                style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${accent}, ${accent}60, transparent)`,
                    flexShrink: 0,
                    opacity: hovered ? 1 : 0.7,
                    transition: 'opacity 0.25s ease',
                }}
            />

            {/* Header */}
            {(title || rightNode || onClose || maximizable) && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 18px',
                        borderBottom: `1px solid ${_AT.glassBorder}`,
                        background: `linear-gradient(180deg, ${accent}06 0%, transparent 100%)`,
                        position: 'relative',
                        zIndex: 2,
                        cursor: draggable ? 'grab' : 'default',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {collapsible && (
                            <button
                                onClick={() => setCollapsed(!collapsed)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: _AT.textMuted,
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    transition: 'transform 0.25s, color 0.2s',
                                    transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)',
                                }}
                            >
                                <ChevronDown size={13} />
                            </button>
                        )}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <h3
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: _AT.textMain,
                                        letterSpacing: '0.01em',
                                        margin: 0,
                                    }}
                                >
                                    {title}
                                </h3>
                                {tag && <ChipBadge label={tag} color={accent} micro />}
                            </div>
                            {subtitle && (
                                <div
                                    style={{ fontSize: 10, color: _AT.textDim, marginTop: 2, fontFamily: _AT.fontMono }}
                                >
                                    {subtitle}
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {onRefresh && (
                            <NanoButton
                                onClick={onRefresh}
                                icon={RefreshCw}
                                spinning={refreshing}
                                color={_AT.textMuted}
                                tooltip="Refresh"
                            />
                        )}
                        {maximizable && (
                            <NanoButton
                                onClick={() => setMaximized(!maximized)}
                                icon={maximized ? Minimize2 : Maximize2}
                                color={_AT.textMuted}
                                tooltip={maximized ? 'Minimize' : 'Maximize'}
                            />
                        )}
                        {onClose && <NanoButton onClick={onClose} icon={X} color={_AT.textMuted} tooltip="Close" />}
                        {rightNode}
                    </div>
                </div>
            )}

            {!collapsed && (
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        position: 'relative',
                        zIndex: 1,
                        padding: '16px 18px',
                        opacity: loading ? 0.35 : 1,
                        transition: 'opacity 0.3s',
                    }}
                >
                    {loading && <LoadingOverlay />}
                    {children}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  2. METRIC CARD v3 — with particle effect
// ═══════════════════════════════════════════════════════════════════════════
export const MetricCard = ({
    icon: Icon,
    title,
    value,
    unit,
    subtitle,
    color = _AT.primary,
    onClick,
    active,
    sparkData,
    trend,
    cacheBadge,
    badge,
    size = 'default',
    delta,
    loading,
    comparison,
    target,
    pulseOnChange = true,
}) => {
    useAdaptiveTheme();
    injectKeyframes();
    const [hovered, hoverProps] = useHover();
    const [pulsing, setPulsing] = useState(false);
    const prevValue = usePrevious(value);
    const isCompact = size === 'compact';

    useEffect(() => {
        if (pulseOnChange && prevValue !== undefined && prevValue !== value) {
            setPulsing(true);
            setTimeout(() => setPulsing(false), 600);
        }
    }, [value, prevValue, pulseOnChange]);

    const progressToTarget = target ? Math.min((parseFloat(value) / target) * 100, 100) : null;

    return (
        <div
            {...hoverProps}
            onClick={onClick}
            className="metric-value"
            style={{
                background: _AT.surface,
                borderRadius: '16px',
                border: `1px solid ${active ? color + '45' : hovered ? color + '25' : _AT.glassBorder}`,
                borderTop: `2px solid ${active || hovered ? color : color + '50'}`,
                padding: isCompact ? 14 : 20,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: isCompact ? 8 : 12,
                cursor: onClick ? 'pointer' : 'default',
                transition: 'box-shadow 0.25s ease, transform 0.2s ease, border-color 0.25s ease',
                transform: hovered && onClick ? 'translateY(-2px)' : 'none',
                boxShadow: hovered
                    ? `${_AT.shadowMd}, 0 0 0 1px ${color}15, 0 4px 20px ${color}10`
                    : active
                      ? `0 2px 8px ${color}20, 0 0 0 1px ${color}15`
                      : _AT.shadowSm || '0 1px 3px rgba(0,0,0,0.08)',
            }}
        >
            {/* Subtle gradient fill on hover */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: `linear-gradient(135deg, ${color}06 0%, transparent 60%)`,
                    opacity: hovered || active ? 1 : 0,
                    transition: 'opacity 0.25s ease',
                    borderRadius: '16px',
                }}
            />
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        width: isCompact ? 36 : 44,
                        height: isCompact ? 36 : 44,
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${color}22, ${color}10)`,
                        border: `1px solid ${color}25`,
                        color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 2px 8px ${color}20`,
                    }}
                >
                    <Icon size={isCompact ? 17 : 21} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {cacheBadge && (
                        <ChipBadge
                            label={cacheBadge}
                            color={cacheBadge === 'HIT' ? _AT.success : _AT.warning}
                            micro
                            dot
                        />
                    )}
                    {badge && <ChipBadge label={badge} color={color} micro />}
                    {active && <ChipBadge label="ACTIVE" color={color} animated />}
                </div>
            </div>

            {sparkData && sparkData.length > 0 && (
                <div style={{ width: '100%', height: 40, marginBottom: -4 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparkData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
                            <defs>
                                <linearGradient id={`spark-${title?.replace(/\s/g, '_')}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={1.5}
                                fill={`url(#spark-${title?.replace(/\s/g, '_')})`}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div style={{ position: 'relative' }}>
                <div
                    style={{
                        fontSize: 11,
                        color: _AT.textMuted,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: 5,
                    }}
                >
                    {title}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    {loading ? (
                        <div
                            style={{
                                width: 80,
                                height: 28,
                                borderRadius: '10px',
                                background: _AT.grid,
                                animation: 'shimmer 1.5s infinite',
                                backgroundSize: '400%',
                            }}
                        />
                    ) : (
                        <>
                            <span
                                style={{
                                    fontSize: isCompact ? 24 : 30,
                                    fontWeight: 800,
                                    fontFamily: _AT.fontMono,
                                    letterSpacing: '-0.03em',
                                    lineHeight: 1,
                                    color: _AT.textMain,
                                    animation: pulsing ? 'valuePulse 0.5s ease-out' : undefined,
                                }}
                            >
                                {value}
                            </span>
                            {unit && (
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: _AT.textMuted,
                                        fontFamily: _AT.fontMono,
                                        fontWeight: 500,
                                    }}
                                >
                                    {unit}
                                </span>
                            )}
                        </>
                    )}
                    {trend !== undefined && trend !== null && (
                        <TrendChip value={trend} size={isCompact ? 'small' : 'default'} />
                    )}
                </div>

                {progressToTarget && (
                    <div style={{ marginTop: 8 }}>
                        <NeonProgressBar value={progressToTarget} max={100} color={color} height={3} showPercent />
                    </div>
                )}

                {comparison && (
                    <div style={{ fontSize: 10, color: _AT.textDim, marginTop: 5, fontFamily: _AT.fontMono }}>
                        {comparison}
                    </div>
                )}
                {subtitle && <div style={{ fontSize: 11, color: _AT.textMuted, marginTop: 4 }}>{subtitle}</div>}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  3. RESOURCE GAUGE — Arc reactor v2
// ═══════════════════════════════════════════════════════════════════════════
export const ResourceGauge = ({
    label,
    value,
    color,
    thresholds,
    size = 160,
    subtitle,
    showHistory = false,
    historyData,
}) => {
    useAdaptiveTheme();
    injectKeyframes();
    const numValue = Number(value) || 0;
    const resolvedColor = thresholds
        ? numValue >= (thresholds.critical || 90)
            ? _AT.danger
            : numValue >= (thresholds.warning || 70)
              ? _AT.warning
              : color
        : color;

    const data = [{ value: numValue, fill: resolvedColor }];

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div
                style={{
                    position: 'relative',
                    height: size,
                    width: size,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                        innerRadius="62%"
                        outerRadius="86%"
                        barSize={8}
                        data={data}
                        startAngle={210}
                        endAngle={-30}
                        cx="50%"
                        cy="50%"
                    >
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar
                            background={{ fill: `${_AT.glassBorder}` }}
                            clockWise
                            dataKey="value"
                            cornerRadius={5}
                        >
                            {data.map((_, i) => (
                                <Cell key={i} fill={resolvedColor} />
                            ))}
                        </RadialBar>
                    </RadialBarChart>
                </ResponsiveContainer>

                <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div
                        style={{
                            fontSize: numValue >= 100 ? 18 : 24,
                            fontWeight: 800,
                            color: resolvedColor,
                            fontFamily: _AT.fontMono,
                            lineHeight: 1,
                            animation: 'countUp 0.8s ease backwards',
                        }}
                    >
                        {numValue}
                        <span style={{ fontSize: 12 }}>%</span>
                    </div>
                    <div
                        style={{
                            fontSize: 9,
                            color: _AT.textMuted,

                            marginTop: 3,
                            fontFamily: _AT.fontDisplay,
                            letterSpacing: '1px',
                        }}
                    >
                        {label}
                    </div>
                    {subtitle && (
                        <div style={{ fontSize: 8, color: _AT.textDim, marginTop: 2, fontFamily: _AT.fontMono }}>
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>

            {showHistory && historyData && historyData.length > 0 && (
                <div style={{ width: '100%', height: 30 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData}>
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={resolvedColor}
                                strokeWidth={1}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  4. NEON PROGRESS BAR — v2
// ═══════════════════════════════════════════════════════════════════════════
export const NeonProgressBar = ({
    value,
    max,
    color = _AT.primary,
    label,
    showPercent = false,
    height = 6,
    thresholds,
    animate = true,
    showMilestones = false,
    milestones = [],
}) => {
    const percent = Math.min((value / (max || 1)) * 100, 100);
    const resolvedColor = thresholds
        ? percent >= (thresholds.critical || 90)
            ? _AT.danger
            : percent >= (thresholds.warning || 70)
              ? _AT.warning
              : color
        : color;

    return (
        <div>
            {(label || showPercent) && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 10,
                        color: _AT.textMuted,
                        fontFamily: _AT.fontMono,
                    }}
                >
                    {label && <span style={{ letterSpacing: '0.5px' }}>{label}</span>}
                    {showPercent && (
                        <span style={{ color: resolvedColor, fontWeight: 700 }}>{percent.toFixed(1)}%</span>
                    )}
                </div>
            )}
            <div
                style={{
                    width: '100%',
                    height,
                    background: _AT.grid,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: `1px solid ${_AT.grid}`,
                }}
            >
                <div
                    style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: resolvedColor,
                        borderRadius: '10px',
                        transition: animate ? 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                    }}
                />
                {/* Milestones */}
                {showMilestones &&
                    milestones.map((m, i) => (
                        <div
                            key={i}
                            style={{
                                position: 'absolute',
                                left: `${m}%`,
                                top: -4,
                                bottom: -4,
                                width: 1,
                                background: _AT.textDim,
                                opacity: 0.4,
                            }}
                        />
                    ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  5. LIVE STATUS BADGE — Enhanced neural link
// ═══════════════════════════════════════════════════════════════════════════
export const LiveStatusBadge = ({ connected = true, label, count, showLatency, latency, quality, uptime }) => {
    injectKeyframes();
    const color = connected ? _AT.success : _AT.danger;
    const qualityColors = { excellent: _AT.success, good: _AT.primary, fair: _AT.warning, poor: _AT.danger };
    const qColor = quality ? qualityColors[quality] || color : color;

    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: `${qColor}08`,
                padding: '5px 12px',
                borderRadius: '6px',
                border: `1px solid ${qColor}18`,
            }}
        >
            <div style={{ position: 'relative', width: 8, height: 8 }}>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        background: qColor,
                    }}
                />
                {connected && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: -4,
                            borderRadius: '50%',
                            background: qColor,
                            opacity: 0.3,
                            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                        }}
                    />
                )}
            </div>
            <span
                style={{
                    color: qColor,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    fontFamily: _AT.fontDisplay,
                }}
            >
                {label || (connected ? 'LIVE' : 'OFFLINE')}
            </span>
            {count !== undefined && (
                <span
                    style={{
                        fontSize: 10,
                        background: `${qColor}14`,
                        color: qColor,
                        padding: '1px 7px',
                        borderRadius: 2,
                        fontFamily: _AT.fontMono,
                        fontWeight: 700,
                        border: `1px solid ${qColor}20`,
                    }}
                >
                    {count}
                </span>
            )}
            {showLatency && latency !== undefined && (
                <span
                    style={{
                        fontSize: 9,
                        color: latency > 100 ? _AT.warning : _AT.textMuted,
                        fontFamily: _AT.fontMono,
                    }}
                >
                    {latency}ms
                </span>
            )}
            {uptime && <span style={{ fontSize: 9, color: _AT.textDim, fontFamily: _AT.fontMono }}>{uptime}</span>}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  6. TOOLTIP — v2 Holographic
// ═══════════════════════════════════════════════════════════════════════════
export const CustomTooltip = ({ active, payload, label, formatter, unit }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                backgroundColor: _AT.surface,
                border: `1px solid ${_AT.glassBorder}`,
                borderRadius: '10px',
                padding: '10px 14px',
                boxShadow: _AT.shadowMd,
                maxWidth: 260,
            }}
        >
            {label && (
                <p
                    style={{
                        color: _AT.textMuted,
                        fontSize: 9,
                        marginBottom: 10,
                        fontFamily: _AT.fontDisplay,
                        letterSpacing: '1.5px',
                    }}
                >
                    {label}
                </p>
            )}
            {payload.map((entry, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: i < payload.length - 1 ? 5 : 0,
                    }}
                >
                    <div style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: entry.color }} />
                    <span style={{ fontSize: 10, color: _AT.textMuted, fontFamily: _AT.fontMono }}>{entry.name}:</span>
                    <span
                        style={{
                            fontSize: 13,
                            color: _AT.textMain,
                            fontWeight: 800,
                            fontFamily: _AT.fontMono,
                            marginLeft: 'auto',
                        }}
                    >
                        {formatter
                            ? formatter(entry.value, entry.name)
                            : typeof entry.value === 'number'
                              ? entry.value.toLocaleString()
                              : entry.value}
                        {unit && <span style={{ fontSize: 10, color: _AT.textMuted }}> {unit}</span>}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  7. ALERT SYSTEM — v2 with toast queue
// ═══════════════════════════════════════════════════════════════════════════
const SEVERITY_CONFIG = {
    critical: { color: _AT.danger, icon: XCircle, bg: 'rgba(255,45,120,0.07)', label: 'CRITICAL' },
    warning: { color: _AT.warning, icon: AlertTriangle, bg: 'rgba(255,170,0,0.07)', label: 'WARNING' },
    info: { color: _AT.info, icon: Info, bg: 'rgba(77,159,255,0.07)', label: 'INFO' },
    success: { color: _AT.success, icon: CheckCircle, bg: 'rgba(16,185,129,0.07)', label: 'SUCCESS' },
};

export const SeverityBadge = ({ severity }) => {
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.info;
    return (
        <span
            style={{
                fontSize: 8,
                fontWeight: 800,

                letterSpacing: '1.5px',
                padding: '2px 9px',
                borderRadius: 2,
                background: `${config.color}15`,
                color: config.color,
                border: `1px solid ${config.color}30`,
                fontFamily: _AT.fontDisplay,
            }}
        >
            {severity}
        </span>
    );
};

export const AlertBanner = ({ alert, onAcknowledge, onDismiss, compact = false }) => {
    injectKeyframes();
    const [acknowledged, setAcknowledged] = useState(false);
    if (!alert) return null;
    const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
    const Icon = config.icon;
    const handleAck = () => {
        setAcknowledged(true);
        onAcknowledge?.(alert.id);
    };

    if (compact) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: config.bg,
                    borderRadius: '10px',
                    border: `1px solid ${config.color}25`,
                    animation: 'alertSlide 0.3s ease backwards',
                }}
            >
                <Icon size={13} color={config.color} />
                <span style={{ color: _AT.textMuted, flex: 1, fontSize: 12, fontFamily: _AT.fontBody }}>
                    {alert.message}
                </span>
                <span style={{ fontSize: 9, color: _AT.textMuted, fontFamily: _AT.fontMono }}>
                    {new Date(alert.ts).toLocaleTimeString()}
                </span>
                {onAcknowledge && !acknowledged && (
                    <button
                        onClick={handleAck}
                        style={{
                            background: `${config.color}12`,
                            border: `1px solid ${config.color}30`,
                            color: config.color,
                            padding: '2px 10px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: 9,
                            fontWeight: 700,
                            fontFamily: _AT.fontDisplay,
                            letterSpacing: '1px',
                        }}
                    >
                        ACK
                    </button>
                )}
                {acknowledged && <CheckCircle size={12} color={_AT.success} />}
            </div>
        );
    }

    return (
        <div
            style={{
                background: config.bg,
                borderRadius: '14px',
                padding: 16,
                border: `1px solid ${config.color}22`,
                animation: 'alertSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                position: 'relative',
                overflow: 'hidden',
                opacity: acknowledged ? 0.6 : 1,
                transition: 'opacity 0.4s',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: config.color,
                }}
            />
            <div
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: '14px',
                    flexShrink: 0,
                    background: `${config.color}12`,
                    color: config.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${config.color}25`,
                }}
            >
                <Icon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <SeverityBadge severity={alert.severity} />
                    {alert.category && (
                        <span
                            style={{
                                fontSize: 9,
                                color: _AT.textMuted,
                                fontFamily: _AT.fontMono,

                                letterSpacing: '1px',
                            }}
                        >
                            {alert.category}
                        </span>
                    )}
                    <span style={{ fontSize: 9, color: _AT.textDim, marginLeft: 'auto', fontFamily: _AT.fontMono }}>
                        {new Date(alert.ts).toLocaleTimeString()}
                    </span>
                </div>
                <p style={{ fontSize: 13, color: _AT.textMain, margin: 0, lineHeight: 1.6, fontFamily: _AT.fontBody }}>
                    {alert.message}
                </p>
                {alert.data && Object.keys(alert.data).length > 0 && (
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 10,
                            color: _AT.textMuted,
                            fontFamily: _AT.fontMono,
                            display: 'flex',
                            gap: 14,
                            flexWrap: 'wrap',
                        }}
                    >
                        {Object.entries(alert.data).map(([k, v]) => (
                            <span key={k}>
                                {k}: <span style={{ color: config.color, fontWeight: 700 }}>{String(v)}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                {onAcknowledge && !acknowledged && (
                    <button
                        onClick={handleAck}
                        style={{
                            background: `${config.color}12`,
                            border: `1px solid ${config.color}30`,
                            color: config.color,
                            padding: '6px 14px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: 9,
                            fontWeight: 700,
                            fontFamily: _AT.fontDisplay,
                            letterSpacing: '1px',
                        }}
                    >
                        ACK
                    </button>
                )}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        style={{
                            background: 'none',
                            border: `1px solid ${_AT.glassBorder}`,
                            color: _AT.textMuted,
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    );
};

// Toast notification stack
export const AlertToast = ({ alerts, onDismiss }) => {
    injectKeyframes();
    return (
        <div
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 600,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxWidth: 380,
            }}
        >
            {alerts.slice(0, 4).map((alert, i) => {
                const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
                const Icon = config.icon;
                return (
                    <div
                        key={alert.id || i}
                        style={{
                            background: 'rgba(2,6,20,0.97)',
                            borderRadius: '14px',
                            padding: '12px 16px',
                            border: `1px solid ${config.color}30`,
                            boxShadow: `0 8px 32px rgba(0,0,0,0.8), 0 0 20px ${config.color}14`,
                            animation: 'alertSlide 0.4s cubic-bezier(0.16,1,0.3,1) backwards',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 2,
                                borderRadius: '4px 0 0 4px',
                                background: config.color,
                            }}
                        />
                        <div style={{ marginLeft: 6 }}>
                            <Icon size={14} color={config.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <SeverityBadge severity={alert.severity} />
                            <p
                                style={{
                                    fontSize: 11,
                                    color: _AT.textMuted,
                                    margin: '4px 0 0',
                                    fontFamily: _AT.fontBody,
                                    lineHeight: 1.5,
                                }}
                            >
                                {alert.message}
                            </p>
                        </div>
                        {onDismiss && (
                            <button
                                onClick={() => onDismiss(alert.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: _AT.textDim,
                                    cursor: 'pointer',
                                    padding: 2,
                                }}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  8. NANO BUTTON — v2 with variants
// ═══════════════════════════════════════════════════════════════════════════
export const NanoButton = ({
    icon: Icon,
    onClick,
    tooltip,
    color = _AT.textMuted,
    active,
    spinning,
    label,
    outlined,
    variant = 'default',
    disabled,
    size = 'default',
}) => {
    const [hovered, hoverProps] = useHover();
    injectKeyframes();
    const sm = size === 'small';
    const lg = size === 'large';

    const variants_styles = {
        default: {
            bg: active || hovered ? `${_AT.primary}10` : 'transparent',
            border: active || hovered ? `${_AT.primary}30` : _AT.glassBorder,
            color: active || hovered ? _AT.primary : color,
        },
        danger: {
            bg: hovered ? `${_AT.danger}10` : `${_AT.danger}05`,
            border: hovered ? `${_AT.danger}30` : `${_AT.danger}18`,
            color: _AT.danger,
        },
        success: {
            bg: hovered ? `${_AT.success}10` : `${_AT.success}05`,
            border: hovered ? `${_AT.success}30` : `${_AT.success}18`,
            color: _AT.success,
        },
        ghost: {
            bg: hovered ? _AT.surfaceHover : 'transparent',
            border: 'transparent',
            color: hovered ? _AT.textMain : _AT.textMuted,
        },
    };
    const vs = variants_styles[variant] || variants_styles.default;

    return (
        <button
            {...hoverProps}
            onClick={onClick}
            disabled={disabled}
            title={tooltip}
            style={{
                background: disabled ? _AT.glass : vs.bg,
                border: `1px solid ${disabled ? _AT.glassBorder : vs.border}`,
                color: disabled ? _AT.textDim : vs.color,
                borderRadius: '10px',
                padding: sm ? '3px 6px' : lg ? '8px 16px' : label ? '5px 12px' : '5px 8px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: sm ? 4 : 5,
                transition: 'all 0.15s',
                fontSize: sm ? 9 : lg ? 12 : 10,
                fontWeight: 600,
                letterSpacing: '0.02em',
                opacity: disabled ? 0.4 : 1,
            }}
        >
            {Icon && (
                <Icon
                    size={sm ? 10 : lg ? 15 : 12}
                    style={{ animation: spinning ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }}
                />
            )}
            {label && <span>{label}</span>}
        </button>
    );
};
export const MiniButton = NanoButton;

// ═══════════════════════════════════════════════════════════════════════════
//  9. DATA TABLE — v2 Cyberpunk grid with multi-select
// ═══════════════════════════════════════════════════════════════════════════
export const DataTable = ({
    columns,
    data,
    sortable = true,
    searchable = false,
    pageSize = 20,
    emptyText = 'NO DATA',
    onRowClick,
    rowKey = 'id',
    compact = false,
    accentColor = _AT.primary,
    selectable = false,
    onSelectionChange,
    rowActions,
    stickyHeader = false,
    striped = false,
}) => {
    useAdaptiveTheme();
    const [sort, setSort] = useState({ key: null, dir: 'asc' });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [showActions, setShowActions] = useState(null);

    const filtered = useMemo(() => {
        if (!search) return data;
        const q = search.toLowerCase();
        return data.filter((row) =>
            columns.some((col) =>
                String(row[col.key] ?? '')
                    .toLowerCase()
                    .includes(q),
            ),
        );
    }, [data, search, columns]);

    const sorted = useMemo(() => {
        if (!sort.key) return filtered;
        return [...filtered].sort((a, b) => {
            const va = a[sort.key],
                vb = b[sort.key];
            const cmp = typeof va === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''));
            return sort.dir === 'asc' ? cmp : -cmp;
        });
    }, [filtered, sort]);

    const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
    const totalPages = Math.ceil(sorted.length / pageSize);

    const toggleSelect = (key) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            onSelectionChange?.(Array.from(next));
            return next;
        });
    };
    const toggleAll = () => {
        const keys = paged.map((r) => r[rowKey]);
        const allSelected = keys.every((k) => selected.has(k));
        setSelected((prev) => {
            const next = new Set(prev);
            if (allSelected) keys.forEach((k) => next.delete(k));
            else keys.forEach((k) => next.add(k));
            onSelectionChange?.(Array.from(next));
            return next;
        });
    };

    return (
        <div>
            {searchable && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                        background: _AT.surfaceHover,
                        borderRadius: '10px',
                        padding: '7px 12px',
                        border: `1px solid ${_AT.glassBorder}`,
                    }}
                >
                    <Search size={11} color={_AT.textMuted} />
                    <input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(0);
                        }}
                        placeholder="Search records..."
                        style={{
                            background: 'none',
                            border: 'none',
                            color: _AT.textMain,
                            fontSize: 11,
                            outline: 'none',
                            flex: 1,
                            fontFamily: _AT.fontMono,
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: _AT.textMuted,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                            }}
                        >
                            <X size={11} />
                        </button>
                    )}
                    <span style={{ fontSize: 9, color: _AT.textDim, fontFamily: _AT.fontMono }}>
                        {sorted.length} results
                    </span>
                </div>
            )}

            {selectable && selected.size > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 8,
                        padding: '6px 12px',
                        background: `${accentColor}08`,
                        borderRadius: '10px',
                        border: `1px solid ${accentColor}20`,
                    }}
                >
                    <span style={{ fontSize: 10, color: accentColor, fontFamily: _AT.fontMono }}>
                        {selected.size} selected
                    </span>
                    <button
                        onClick={() => setSelected(new Set())}
                        style={{
                            fontSize: 9,
                            color: _AT.textMuted,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: _AT.fontMono,
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}

            <div style={{ overflowX: 'auto', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead
                        style={{
                            position: stickyHeader ? 'sticky' : 'static',
                            top: 0,
                            zIndex: 2,
                            background: stickyHeader ? _AT.surface : 'none',
                        }}
                    >
                        <tr style={{ borderBottom: `1px solid ${accentColor}18` }}>
                            {selectable && (
                                <th
                                    style={{
                                        width: 36,
                                        padding: compact ? '7px 8px' : '10px 12px',
                                        textAlign: 'center',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={paged.every((r) => selected.has(r[rowKey]))}
                                        onChange={toggleAll}
                                        style={{ accentColor, cursor: 'pointer' }}
                                    />
                                </th>
                            )}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={() => {
                                        if (sortable && col.sortable !== false)
                                            setSort((prev) => ({
                                                key: col.key,
                                                dir: prev.key === col.key && prev.dir === 'asc' ? 'desc' : 'asc',
                                            }));
                                    }}
                                    style={{
                                        textAlign: col.align || 'left',
                                        padding: compact ? '7px 10px' : '10px 14px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: sort.key === col.key ? _AT.textMain : _AT.textMuted,
                                        borderBottom: `1px solid ${_AT.glassBorder}`,
                                        cursor: sortable && col.sortable !== false ? 'pointer' : 'default',
                                        whiteSpace: 'nowrap',
                                        userSelect: 'none',
                                        transition: 'color 0.2s',
                                    }}
                                >
                                    {col.label}
                                    {sort.key === col.key && (
                                        <span style={{ marginLeft: 5, color: accentColor }}>
                                            {sort.dir === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </th>
                            ))}
                            {rowActions && <th style={{ width: 40 }} />}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (selectable ? 1 : 0)}
                                    style={{
                                        textAlign: 'center',
                                        padding: 32,
                                        color: _AT.textDim,
                                        fontSize: 11,
                                        fontFamily: _AT.fontMono,
                                    }}
                                >
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            paged.map((row, ri) => (
                                <tr
                                    key={row[rowKey] ?? ri}
                                    onClick={() => onRowClick?.(row)}
                                    onMouseEnter={() => setHoveredRow(ri)}
                                    onMouseLeave={() => {
                                        setHoveredRow(null);
                                        setShowActions(null);
                                    }}
                                    style={{
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        background: selected.has(row[rowKey])
                                            ? `${accentColor}08`
                                            : hoveredRow === ri
                                              ? _AT.surfaceHover
                                              : striped && ri % 2 === 0
                                                ? _AT.surfaceHover
                                                : 'transparent',
                                        transition: 'background 0.1s',
                                        borderLeft: selected.has(row[rowKey])
                                            ? `2px solid ${accentColor}60`
                                            : hoveredRow === ri
                                              ? `2px solid ${accentColor}30`
                                              : '2px solid transparent',
                                    }}
                                >
                                    {selectable && (
                                        <td style={{ padding: compact ? '7px 8px' : '10px 12px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selected.has(row[rowKey])}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(row[rowKey]);
                                                }}
                                                style={{ accentColor, cursor: 'pointer' }}
                                            />
                                        </td>
                                    )}
                                    {columns.map((col) => (
                                        <td
                                            key={col.key}
                                            style={{
                                                padding: compact ? '7px 10px' : '10px 14px',
                                                fontSize: compact ? 11 : 12,
                                                color: _AT.textMuted,
                                                borderBottom: `1px solid ${_AT.grid}`,
                                                textAlign: col.align || 'left',
                                                fontFamily: col.mono ? _AT.fontMono : _AT.fontBody,
                                                maxWidth: col.maxWidth || 'none',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                                        </td>
                                    ))}
                                    {rowActions && hoveredRow === ri && (
                                        <td style={{ padding: '0 8px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                                                {rowActions(row).map((action, ai) => (
                                                    <NanoButton
                                                        key={ai}
                                                        icon={action.icon}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            action.onClick(row);
                                                        }}
                                                        tooltip={action.label}
                                                        size="small"
                                                        variant={action.variant}
                                                    />
                                                ))}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 12,
                        fontSize: 10,
                        color: _AT.textMuted,
                        fontFamily: _AT.fontMono,
                    }}
                >
                    <span>
                        {sorted.length} rows · page {page + 1}/{totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            style={{
                                background: 'none',
                                border: `1px solid ${_AT.glassBorder}`,
                                color: _AT.textDim,
                                width: 26,
                                height: 26,
                                borderRadius: '10px',
                                cursor: page === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: page === 0 ? 0.4 : 1,
                            }}
                        >
                            <ChevronLeft size={11} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i)}
                                style={{
                                    background: page === i ? `${accentColor}20` : _AT.surfaceHover,
                                    border: `1px solid ${page === i ? accentColor + '50' : _AT.glassBorder}`,
                                    color: page === i ? accentColor : _AT.textDim,
                                    width: 26,
                                    height: 26,
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    fontFamily: _AT.fontMono,
                                }}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page === totalPages - 1}
                            style={{
                                background: 'none',
                                border: `1px solid ${_AT.glassBorder}`,
                                color: _AT.textDim,
                                width: 26,
                                height: 26,
                                borderRadius: '10px',
                                cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: page === totalPages - 1 ? 0.4 : 1,
                            }}
                        >
                            <ChevronRight size={11} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  10. EMPTY STATE — Signal lost v2
// ═══════════════════════════════════════════════════════════════════════════
export const EmptyState = ({ icon: Icon = Info, title, text, action, onAction, color = _AT.primary }) => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 14,
            padding: 40,
            position: 'relative',
        }}
    >
        <div style={{ position: 'relative' }}>
            <div
                style={{
                    width: 76,
                    height: 76,
                    borderRadius: '14px',
                    background: _AT.surfaceHover,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${_AT.glassBorder}`,
                    color: _AT.textDim,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <CornerBrackets color={_AT.textDim} size={8} />
                <Icon size={30} style={{ animation: 'floatUp 3s ease-in-out infinite' }} />
            </div>
        </div>
        {title && (
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: _AT.textMuted,
                }}
            >
                {title}
            </div>
        )}
        <div
            style={{
                fontSize: 12,
                textAlign: 'center',
                maxWidth: 260,
                color: _AT.textMuted,
                lineHeight: 1.6,
            }}
        >
            {text}
        </div>
        {action && <NanoButton label={action} onClick={onAction} color={color} outlined size="large" />}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  11. SKELETON LOADER — Neural loading state v2
// ═══════════════════════════════════════════════════════════════════════════
export const SkeletonLoader = ({ rows = 3, height = 16, gap = 10, style: customStyle, variant = 'line' }) => {
    injectKeyframes();
    if (variant === 'card') {
        return (
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                    ...customStyle,
                }}
            >
                {Array.from({ length: rows }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            height: 120,
                            borderRadius: '14px',
                            background: _AT.glass,
                            border: `1px solid ${_AT.glassBorder}`,
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                background:
                                    'linear-gradient(90deg, transparent 0%, rgba(0,245,255,0.06) 50%, transparent 100%)',
                                backgroundSize: '400% 100%',
                                animation: 'shimmer 1.8s ease infinite',
                                animationDelay: `${i * 0.1}s`,
                            }}
                        />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap, ...customStyle }}>
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        height,
                        borderRadius: 2,
                        background:
                            'linear-gradient(90deg, rgba(0,245,255,0.02) 25%, rgba(0,245,255,0.07) 50%, rgba(0,245,255,0.02) 75%)',
                        backgroundSize: '400% 100%',
                        animation: `shimmer 2s ease ${i * 0.05}s infinite`,
                        width: i === rows - 1 ? '55%' : '100%',
                        boxShadow: `inset 0 1px 0 rgba(0,245,255,0.04)`,
                    }}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  12. LOADING OVERLAY — Enhanced plasma spinner
// ═══════════════════════════════════════════════════════════════════════════
export const LoadingOverlay = ({ message }) => {
    injectKeyframes();
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${_AT.bg}cc`,
                zIndex: 20,
                borderRadius: '14px',
                gap: 12,
            }}
        >
            <div
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: `2px solid ${_AT.glassBorder}`,
                    borderTop: `2px solid ${_AT.primary}`,
                    animation: 'spin 0.8s linear infinite',
                }}
            />
            {message && <span style={{ fontSize: 11, color: _AT.textMuted }}>{message}</span>}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  13. STATUS DOT & COPY BUTTON
// ═══════════════════════════════════════════════════════════════════════════
export const StatusDot = ({ status, size = 8, pulse: doPulse = false }) => {
    injectKeyframes();
    const color =
        {
            active: _AT.success,
            ok: _AT.success,
            idle: _AT.warning,
            error: _AT.danger,
            critical: _AT.danger,
            warning: _AT.warning,
        }[status] || _AT.textMuted;
    return <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0 }} />;
};

export const CopyButton = ({ text, size = 'default', label }) => {
    const [copied, copy] = useCopyToClipboard();
    const sm = size === 'small';
    return (
        <button
            onClick={() => copy(text)}
            style={{
                background: copied ? `${_AT.success}10` : _AT.glass,
                border: `1px solid ${copied ? _AT.success + '40' : _AT.glassBorder}`,
                color: copied ? _AT.success : _AT.textMuted,
                padding: sm ? '3px 8px' : '5px 12px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: sm ? 9 : 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.2s',
                fontFamily: _AT.fontMono,
                fontWeight: 700,
            }}
        >
            {copied ? <Check size={sm ? 9 : 11} /> : <Copy size={sm ? 9 : 11} />}
            {label || (copied ? 'COPIED' : 'COPY')}
        </button>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  14. TERMINAL — v2 with full typewriter + multi-line + history
// ═══════════════════════════════════════════════════════════════════════════
export const Terminal = ({ lines = [], title = 'neural://shell', onExecute, readOnly = false, maxHeight = 300 }) => {
    injectKeyframes();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState(lines);
    const [histIdx, setHistIdx] = useState(-1);
    const [cmdHistory, setCmdHistory] = useState([]);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const execute = () => {
        if (!input.trim()) return;
        const newHistory = [...history, { type: 'input', content: input }];
        const result = onExecute?.(input);
        if (result) newHistory.push({ type: 'output', content: result });
        setHistory(newHistory);
        setCmdHistory((prev) => [input, ...prev]);
        setInput('');
        setHistIdx(-1);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter') execute();
        if (e.key === 'ArrowUp') {
            const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
            setHistIdx(idx);
            setInput(cmdHistory[idx] || '');
        }
        if (e.key === 'ArrowDown') {
            const idx = Math.max(histIdx - 1, -1);
            setHistIdx(idx);
            setInput(idx === -1 ? '' : cmdHistory[idx] || '');
        }
    };

    const typeColors = {
        input: _AT.textMain,
        output: _AT.info,
        error: _AT.danger,
        success: _AT.success,
        info: _AT.textMuted,
        system: _AT.warning,
    };

    return (
        <div
            style={{
                background: _AT.deepTeal,
                borderRadius: '14px',
                border: `1px solid ${_AT.glassBorder}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
            }}
        >
            <ScanlineOverlay opacity={0.015} />
            {/* Header */}
            <div
                style={{
                    background: _AT.bg,
                    padding: '8px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: `1px solid ${_AT.glassBorder}`,
                    position: 'relative',
                    zIndex: 2,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: _AT.danger,
                            boxShadow: `0 0 6px ${_AT.danger}90`,
                        }}
                    />
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: _AT.warning,
                            boxShadow: `0 0 6px ${_AT.warning}90`,
                        }}
                    />
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: _AT.success,
                            boxShadow: `0 0 6px ${_AT.success}90`,
                        }}
                    />
                    <span style={{ marginLeft: 8, fontSize: 10, color: _AT.textMuted, fontFamily: _AT.fontMono }}>
                        {title}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <CopyButton text={history.map((l) => l.content).join('\n')} size="small" />
                </div>
            </div>
            {/* Output */}
            <div
                style={{
                    padding: '12px 16px',
                    fontFamily: _AT.fontMono,
                    fontSize: 12,
                    lineHeight: 1.85,
                    overflowY: 'auto',
                    maxHeight,
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {history.map((line, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            animation: `fadeUp 0.2s ease ${i < 3 ? i * 0.05 : 0}s backwards`,
                        }}
                    >
                        {line.type === 'input' && (
                            <span style={{ color: _AT.success, flexShrink: 0, userSelect: 'none' }}>{'▶'}</span>
                        )}
                        {line.type === 'error' && (
                            <span style={{ color: _AT.danger, flexShrink: 0, userSelect: 'none' }}>{'✕'}</span>
                        )}
                        {line.type === 'success' && (
                            <span style={{ color: _AT.success, flexShrink: 0, userSelect: 'none' }}>{'✓'}</span>
                        )}
                        {line.type === 'system' && (
                            <span style={{ color: _AT.warning, flexShrink: 0, userSelect: 'none' }}>{'⬡'}</span>
                        )}
                        {!['input', 'error', 'success', 'system'].includes(line.type) && (
                            <span style={{ color: _AT.textDim, flexShrink: 0, userSelect: 'none' }}>{'·'}</span>
                        )}
                        <span style={{ color: typeColors[line.type] || _AT.textMuted, wordBreak: 'break-all' }}>
                            {line.content}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            {/* Input */}
            {!readOnly && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderTop: `1px solid ${_AT.glassBorder}`,
                        background: _AT.inkBlack,
                        position: 'relative',
                        zIndex: 2,
                    }}
                >
                    <span style={{ color: _AT.success, fontFamily: _AT.fontMono, fontSize: 13, userSelect: 'none' }}>
                        $
                    </span>
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Enter command..."
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            color: _AT.textMain,
                            fontFamily: _AT.fontMono,
                            fontSize: 12,
                            outline: 'none',
                        }}
                    />
                    <NanoButton
                        icon={Play}
                        onClick={execute}
                        color={_AT.success}
                        size="small"
                        tooltip="Execute (Enter)"
                    />
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  15. FILTER PILLS — v2
// ═══════════════════════════════════════════════════════════════════════════
export const FilterPills = ({ options, active, onChange, multi = false, color = _AT.primary }) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map((opt) => {
            const key = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            const icon = typeof opt === 'object' ? opt.icon : null;
            const isActive = multi ? active?.includes(key) : active === key;
            return (
                <button
                    key={key}
                    onClick={() => onChange(key)}
                    style={{
                        background: isActive ? `${color}14` : _AT.glass,
                        border: `1px solid ${isActive ? color + '45' : _AT.glassBorder}`,
                        color: isActive ? color : _AT.textMuted,
                        padding: '4px 12px',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontSize: 9,
                        fontWeight: 700,
                        transition: 'all 0.2s',
                        fontFamily: _AT.fontDisplay,
                        letterSpacing: '1px',

                        boxShadow: isActive ? `0 0 12px ${color}18` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                    }}
                >
                    {icon && React.createElement(icon, { size: 10 })}
                    {label}
                </button>
            );
        })}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
//  16. TIMELINE — Event stream visualizer
// ═══════════════════════════════════════════════════════════════════════════
export const Timeline = ({ events = [], maxHeight = 400 }) => {
    injectKeyframes();
    return (
        <div style={{ overflowY: 'auto', maxHeight, paddingRight: 4 }}>
            {events.map((event, i) => {
                const config = SEVERITY_CONFIG[event.type] || SEVERITY_CONFIG.info;
                const Icon = config.icon;
                return (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            gap: 12,
                            marginBottom: 0,
                            animation: `fadeUp 0.3s ease ${i * 0.04}s backwards`,
                        }}
                    >
                        {/* Line + dot */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '14px',
                                    background: `${config.color}12`,
                                    border: `1px solid ${config.color}28`,
                                    color: config.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1,
                                    flexShrink: 0,
                                }}
                            >
                                <Icon size={12} />
                            </div>
                            {i < events.length - 1 && (
                                <div
                                    style={{
                                        width: 1,
                                        flex: 1,
                                        minHeight: 20,
                                        background: `linear-gradient(${config.color}30, transparent)`,
                                        margin: '4px 0',
                                    }}
                                />
                            )}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, paddingBottom: 16, paddingTop: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: _AT.textMain,
                                        fontFamily: _AT.fontBody,
                                    }}
                                >
                                    {event.title}
                                </span>
                                <SeverityBadge severity={event.type} />
                                <span
                                    style={{
                                        fontSize: 9,
                                        color: _AT.textDim,
                                        marginLeft: 'auto',
                                        fontFamily: _AT.fontMono,
                                    }}
                                >
                                    {new Date(event.ts).toLocaleTimeString()}
                                </span>
                            </div>
                            {event.description && (
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: _AT.textMuted,
                                        margin: 0,
                                        lineHeight: 1.6,
                                        fontFamily: _AT.fontBody,
                                    }}
                                >
                                    {event.description}
                                </p>
                            )}
                            {event.meta && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                                    {Object.entries(event.meta).map(([k, v]) => (
                                        <span
                                            key={k}
                                            style={{ fontSize: 9, fontFamily: _AT.fontMono, color: _AT.textDim }}
                                        >
                                            {k}: <span style={{ color: config.color }}>{String(v)}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  17. RADAR CHART — Multi-axis performance viz
// ═══════════════════════════════════════════════════════════════════════════
export const RadarMetric = ({ data = [], size = 200, color = _AT.primary, label }) => {
    injectKeyframes();
    const n = data.length;
    if (n < 3) return null;
    const cx = size / 2,
        cy = size / 2;
    const r = (size / 2) * 0.72;
    const angleStep = (2 * Math.PI) / n;
    const toXY = (i, val, radius) => {
        const angle = i * angleStep - Math.PI / 2;
        return {
            x: cx + radius * (val / 100) * Math.cos(angle),
            y: cy + radius * (val / 100) * Math.sin(angle),
        };
    };
    const gridLevels = [25, 50, 75, 100];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <svg width={size} height={size}>
                <defs>
                    <radialGradient id="radar-fill">
                        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.08} />
                    </radialGradient>
                </defs>
                {/* Grid rings */}
                {gridLevels.map((level) => {
                    const pts = data.map((_, i) => {
                        const p = toXY(i, level, r);
                        return `${p.x},${p.y}`;
                    });
                    return (
                        <polygon key={level} points={pts.join(' ')} fill="none" stroke={`${color}12`} strokeWidth={1} />
                    );
                })}
                {/* Spoke lines */}
                {data.map((_, i) => {
                    const end = toXY(i, 100, r);
                    return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={`${color}15`} strokeWidth={1} />;
                })}
                {/* Data polygon */}
                <polygon
                    points={data
                        .map((d, i) => {
                            const p = toXY(i, d.value, r);
                            return `${p.x},${p.y}`;
                        })
                        .join(' ')}
                    fill="url(#radar-fill)"
                    stroke={color}
                    strokeWidth={1.5}
                    style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
                />
                {/* Data points */}
                {data.map((d, i) => {
                    const p = toXY(i, d.value, r);
                    return (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={3.5}
                            fill={color}
                            stroke="rgba(0,0,0,0.5)"
                            strokeWidth={1}
                            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                        />
                    );
                })}
                {/* Labels */}
                {data.map((d, i) => {
                    const p = toXY(i, 120, r);
                    return (
                        <text
                            key={i}
                            x={p.x}
                            y={p.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{
                                fontSize: 8,
                                fill: _AT.textMuted,
                                fontFamily: _AT.fontDisplay,
                                letterSpacing: '0.5px',
                            }}
                        >
                            {d.label}
                        </text>
                    );
                })}
            </svg>
            {label && (
                <div
                    style={{
                        fontSize: 10,
                        color: _AT.textMuted,
                        fontFamily: _AT.fontDisplay,
                        letterSpacing: '2px',
                    }}
                >
                    {label}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  18. TYPEWRITER TEXT — Animated command output
// ═══════════════════════════════════════════════════════════════════════════
export const TypewriterText = ({ text, speed = 30, color = _AT.primary, mono = true, onDone, prefix = '' }) => {
    injectKeyframes();
    const [displayed, done] = useTypewriter(text, speed, true);
    useEffect(() => {
        if (done) onDone?.();
    }, [done]);
    return (
        <span style={{ fontFamily: mono ? _AT.fontMono : _AT.fontBody, color, fontSize: 'inherit' }}>
            {prefix && <span style={{ color: _AT.success }}>{prefix} </span>}
            {displayed}
            {!done && (
                <span
                    style={{
                        borderRight: `2px solid ${color}`,
                        animation: 'blink 0.8s step-end infinite',
                        marginLeft: 1,
                    }}
                />
            )}
        </span>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  19. HEATMAP CALENDAR — Activity grid
// ═══════════════════════════════════════════════════════════════════════════
export const HeatmapGrid = ({ data = [], weeks = 26, color = _AT.primary, label }) => {
    injectKeyframes();
    const maxVal = Math.max(...data.map((d) => d.value || 0), 1);
    const cells = Array.from({ length: weeks * 7 }, (_, i) => data[i] || { value: 0 });
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {label && (
                <div
                    style={{
                        fontSize: 9,
                        color: _AT.textMuted,
                        fontFamily: _AT.fontDisplay,
                        letterSpacing: '1.5px',

                        marginBottom: 2,
                    }}
                >
                    {label}
                </div>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 16 }}>
                    {days.map((d, i) => (
                        <div
                            key={i}
                            style={{
                                height: 11,
                                fontSize: 8,
                                color: _AT.textDim,
                                fontFamily: _AT.fontMono,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            {d}
                        </div>
                    ))}
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${weeks}, 11px)`,
                        gridTemplateRows: 'repeat(7, 11px)',
                        gap: 2,
                    }}
                >
                    {cells.map((cell, i) => {
                        const intensity = cell.value / maxVal;
                        return (
                            <div
                                key={i}
                                title={`${cell.date || ''}: ${cell.value}`}
                                style={{
                                    width: 11,
                                    height: 11,
                                    borderRadius: 2,
                                    background: intensity > 0 ? color : _AT.glass,
                                    opacity: intensity > 0 ? Math.max(0.15, intensity) : 1,
                                    border: `1px solid rgba(255,255,255,0.04)`,
                                    cursor: 'default',
                                    transition: 'opacity 0.2s',
                                    boxShadow: intensity > 0.7 ? `0 0 ${intensity * 6}px ${color}60` : 'none',
                                }}
                            />
                        );
                    })}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 8, color: _AT.textDim, fontFamily: _AT.fontMono }}>Less</span>
                {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
                    <div
                        key={i}
                        style={{
                            width: 11,
                            height: 11,
                            borderRadius: 2,
                            background: v > 0 ? color : _AT.glass,
                            opacity: v > 0 ? Math.max(0.15, v) : 1,
                        }}
                    />
                ))}
                <span style={{ fontSize: 8, color: _AT.textDim, fontFamily: _AT.fontMono }}>More</span>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  20. COMMAND PALETTE — Full-featured
// ═══════════════════════════════════════════════════════════════════════════
export const CommandPalette = ({ commands = [], onClose, placeholder = 'Search commands...' }) => {
    injectKeyframes();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const groups = useMemo(() => {
        const filtered = commands.filter(
            (c) =>
                !query ||
                c.label.toLowerCase().includes(query.toLowerCase()) ||
                c.description?.toLowerCase().includes(query.toLowerCase()),
        );
        const grouped = {};
        filtered.forEach((c) => {
            const g = c.group || 'General';
            if (!grouped[g]) grouped[g] = [];
            grouped[g].push(c);
        });
        return grouped;
    }, [commands, query]);

    const flat = Object.values(groups).flat();

    const handleKey = (e) => {
        if (e.key === 'ArrowDown') setSelected((s) => Math.min(s + 1, flat.length - 1));
        if (e.key === 'ArrowUp') setSelected((s) => Math.max(s - 1, 0));
        if (e.key === 'Enter' && flat[selected]) {
            flat[selected].action?.();
            onClose?.();
        }
        if (e.key === 'Escape') onClose?.();
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 500,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '12vh',
                background: 'rgba(0,0,20,0.85)',
                animation: 'fadeIn 0.15s ease',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 580,
                    background: 'rgba(4,9,28,0.98)',
                    borderRadius: '12px',
                    border: `1px solid ${_AT.glassBorderHover}`,
                    boxShadow: `0 0 0 1px ${_AT.primary}20, 0 32px 80px rgba(0,0,0,0.9)`,
                    overflow: 'hidden',
                    animation: 'scaleUp 0.2s cubic-bezier(0.16,1,0.3,1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <CornerBrackets color={_AT.primary} size={12} glowing />
                {/* Search */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '14px 18px',
                        borderBottom: `1px solid ${_AT.glassBorder}`,
                    }}
                >
                    <Search size={14} color={_AT.textMuted} />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelected(0);
                        }}
                        onKeyDown={handleKey}
                        placeholder={placeholder}
                        style={{
                            flex: 1,
                            background: 'none',
                            border: 'none',
                            color: _AT.textMain,
                            fontSize: 14,
                            outline: 'none',
                            fontFamily: _AT.fontBody,
                        }}
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: _AT.textDim,
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                            }}
                        >
                            <X size={13} />
                        </button>
                    )}
                    <kbd
                        style={{
                            fontSize: 9,
                            color: _AT.textDim,
                            background: _AT.glass,
                            border: `1px solid ${_AT.glassBorder}`,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            fontFamily: _AT.fontMono,
                        }}
                    >
                        ESC
                    </kbd>
                </div>
                {/* Results */}
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {Object.entries(groups).map(([group, items]) => (
                        <div key={group}>
                            <div
                                style={{
                                    padding: '8px 18px 4px',
                                    fontSize: 9,
                                    color: _AT.textDim,
                                    fontFamily: _AT.fontDisplay,
                                    letterSpacing: '1.5px',
                                }}
                            >
                                {group}
                            </div>
                            {items.map((cmd, ci) => {
                                const gi = flat.indexOf(cmd);
                                const isSelected = gi === selected;
                                const Icon = cmd.icon;
                                return (
                                    <div
                                        key={ci}
                                        onClick={() => {
                                            cmd.action?.();
                                            onClose?.();
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: '10px 18px',
                                            background: isSelected ? `${_AT.primary}08` : 'transparent',
                                            borderLeft: `2px solid ${isSelected ? _AT.primary : 'transparent'}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.1s',
                                        }}
                                    >
                                        {Icon && (
                                            <div
                                                style={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: '14px',
                                                    background: `${_AT.primary}10`,
                                                    color: _AT.primary,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: `1px solid ${_AT.primary}20`,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon size={13} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: isSelected ? _AT.textMain : _AT.textMuted,
                                                    fontFamily: _AT.fontBody,
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {cmd.label}
                                            </div>
                                            {cmd.description && (
                                                <div style={{ fontSize: 10, color: _AT.textDim, marginTop: 1 }}>
                                                    {cmd.description}
                                                </div>
                                            )}
                                        </div>
                                        {cmd.shortcut && (
                                            <kbd
                                                style={{
                                                    fontSize: 9,
                                                    color: _AT.textDim,
                                                    background: _AT.glass,
                                                    border: `1px solid ${_AT.glassBorder}`,
                                                    padding: '2px 7px',
                                                    borderRadius: '10px',
                                                    fontFamily: _AT.fontMono,
                                                }}
                                            >
                                                {cmd.shortcut}
                                            </kbd>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    {flat.length === 0 && (
                        <div
                            style={{
                                padding: 32,
                                textAlign: 'center',
                                fontSize: 12,
                                color: _AT.textDim,
                                fontFamily: _AT.fontMono,
                            }}
                        >
                            No commands found
                        </div>
                    )}
                </div>
                <div
                    style={{
                        padding: '8px 18px',
                        borderTop: `1px solid ${_AT.glassBorder}`,
                        display: 'flex',
                        gap: 16,
                        fontSize: 9,
                        color: _AT.textDim,
                        fontFamily: _AT.fontMono,
                    }}
                >
                    <span>
                        <kbd
                            style={{
                                background: _AT.glass,
                                padding: '1px 5px',
                                borderRadius: 2,
                                border: `1px solid ${_AT.glassBorder}`,
                            }}
                        >
                            ↑↓
                        </kbd>{' '}
                        navigate
                    </span>
                    <span>
                        <kbd
                            style={{
                                background: _AT.glass,
                                padding: '1px 5px',
                                borderRadius: 2,
                                border: `1px solid ${_AT.glassBorder}`,
                            }}
                        >
                            ↵
                        </kbd>{' '}
                        select
                    </span>
                    <span>
                        <kbd
                            style={{
                                background: _AT.glass,
                                padding: '1px 5px',
                                borderRadius: 2,
                                border: `1px solid ${_AT.glassBorder}`,
                            }}
                        >
                            esc
                        </kbd>{' '}
                        close
                    </span>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  21. NETWORK GRAPH — Node relation visualizer
// ═══════════════════════════════════════════════════════════════════════════
export const NetworkGraph = ({ nodes = [], edges = [], width = 400, height = 300 }) => {
    injectKeyframes();
    const svgRef = useRef(null);
    const [hoveredNode, setHoveredNode] = useState(null);

    const statusColors = { active: _AT.success, warning: _AT.warning, error: _AT.danger, idle: _AT.textMuted };

    return (
        <svg ref={svgRef} width="100%" height={height} style={{ overflow: 'visible' }}>
            <defs>
                <filter id="node-glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={_AT.textDim} />
                </marker>
            </defs>
            {/* Edges */}
            {edges.map((edge, i) => {
                const from = nodes.find((n) => n.id === edge.from);
                const to = nodes.find((n) => n.id === edge.to);
                if (!from || !to) return null;
                const color = edge.active ? _AT.primary : _AT.textDim;
                return (
                    <g key={i}>
                        <line
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            stroke={color}
                            strokeOpacity={0.3}
                            strokeWidth={1}
                            markerEnd="url(#arrow)"
                            style={{ animation: edge.active ? 'pulse 2s ease-in-out infinite' : 'none' }}
                        />
                        {edge.label && (
                            <text
                                x={(from.x + to.x) / 2}
                                y={(from.y + to.y) / 2 - 6}
                                textAnchor="middle"
                                style={{ fontSize: 8, fill: _AT.textDim, fontFamily: _AT.fontMono }}
                            >
                                {edge.label}
                            </text>
                        )}
                    </g>
                );
            })}
            {/* Nodes */}
            {nodes.map((node) => {
                const color = statusColors[node.status] || _AT.primary;
                const isHovered = hoveredNode === node.id;
                return (
                    <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: 'pointer' }}
                    >
                        {isHovered && <circle r={24} fill={color} opacity={0.08} />}
                        <circle
                            r={16}
                            fill="rgba(4,9,28,0.95)"
                            stroke={color}
                            strokeWidth={isHovered ? 2 : 1}
                            filter="url(#node-glow)"
                            style={{ transition: 'all 0.2s' }}
                        />
                        {isHovered && (
                            <circle
                                r={22}
                                fill="none"
                                stroke={color}
                                strokeWidth={1}
                                opacity={0.3}
                                style={{ animation: 'ping 1.5s ease-out infinite' }}
                            />
                        )}
                        <text
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{
                                fontSize: 9,
                                fill: color,
                                fontFamily: _AT.fontDisplay,
                                fontWeight: 700,
                                letterSpacing: '0.5px',
                            }}
                        >
                            {node.label || node.id}
                        </text>
                        <text
                            y={26}
                            textAnchor="middle"
                            style={{ fontSize: 8, fill: _AT.textDim, fontFamily: _AT.fontMono }}
                        >
                            {node.subtitle || ''}
                        </text>
                        {/* Status dot */}
                        <circle
                            cx={12}
                            cy={-12}
                            r={4}
                            fill={color}
                            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
                        />
                    </g>
                );
            })}
        </svg>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  22. WAVEFORM DISPLAY — Audio/signal visualizer
// ═══════════════════════════════════════════════════════════════════════════
export const WaveformBar = ({ bars = 32, color = _AT.primary, active = true, heights }) => {
    injectKeyframes();
    const [animatedHeights, setAnimatedHeights] = useState(
        heights || Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2),
    );

    useInterval(() => {
        if (active && !heights) {
            setAnimatedHeights(Array.from({ length: bars }, () => Math.random() * 0.8 + 0.2));
        }
    }, 120);

    const h = heights || animatedHeights;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 40 }}>
            {Array.from({ length: bars }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        borderRadius: 2,
                        background: `linear-gradient(to top, ${color}80, ${color})`,
                        boxShadow: active ? `0 0 4px ${color}60` : 'none',
                        height: `${(h[i] || 0.3) * 100}%`,
                        transition: 'height 0.1s ease',
                        minWidth: 2,
                    }}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  23. STAT COMPARISON CARD — Before/After delta
// ═══════════════════════════════════════════════════════════════════════════
export const StatCompare = ({ label, before, after, unit, color = _AT.primary, inverse = false }) => {
    injectKeyframes();
    const delta = after - before;
    const pct = before !== 0 ? ((delta / before) * 100).toFixed(1) : 0;
    const improved = inverse ? delta < 0 : delta > 0;
    const trendColor = improved ? _AT.success : delta === 0 ? _AT.textMuted : _AT.danger;

    return (
        <div
            style={{
                background: 'rgba(4,9,28,0.7)',
                borderRadius: '14px',
                padding: 16,
                border: `1px solid ${_AT.glassBorder}`,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    fontSize: 9,
                    color: _AT.textMuted,
                    fontFamily: _AT.fontDisplay,
                    letterSpacing: '1.5px',

                    marginBottom: 12,
                }}
            >
                {label}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div>
                    <div style={{ fontSize: 9, color: _AT.textDim, fontFamily: _AT.fontMono, marginBottom: 3 }}>
                        BEFORE
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 700, color: _AT.textMuted, fontFamily: _AT.fontMono }}>
                        {before.toLocaleString()}
                        {unit && <span style={{ fontSize: 11 }}> {unit}</span>}
                    </span>
                </div>
                <div style={{ fontSize: 16, color: _AT.textDim, marginBottom: 6 }}>→</div>
                <div>
                    <div style={{ fontSize: 9, color: _AT.textDim, fontFamily: _AT.fontMono, marginBottom: 3 }}>
                        AFTER
                    </div>
                    <span
                        style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: _AT.textMain,
                            fontFamily: _AT.fontMono,
                            textShadow: `0 0 20px ${color}60`,
                        }}
                    >
                        {after.toLocaleString()}
                        {unit && <span style={{ fontSize: 11, color: _AT.textMuted }}> {unit}</span>}
                    </span>
                </div>
                <div style={{ marginBottom: 4, marginLeft: 'auto' }}>
                    <TrendChip value={parseFloat(pct)} />
                </div>
            </div>
            <div style={{ marginTop: 10 }}>
                <NeonProgressBar
                    value={Math.min(after, Math.max(before, after))}
                    max={Math.max(before, after) * 1.1}
                    color={trendColor}
                    height={3}
                />
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  24. PILL INPUT — Tag/token input
// ═══════════════════════════════════════════════════════════════════════════
export const PillInput = ({ value = [], onChange, placeholder = 'Add tag...', color = _AT.primary, maxTags = 10 }) => {
    const [input, setInput] = useState('');
    const [focused, setFocused] = useState(false);

    const add = () => {
        const v = input.trim();
        if (!v || value.includes(v) || value.length >= maxTags) return;
        onChange([...value, v]);
        setInput('');
    };

    const remove = (tag) => onChange(value.filter((t) => t !== tag));

    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                padding: '8px 12px',
                background: _AT.shadowMd,
                borderRadius: '14px',
                border: `1px solid ${focused ? _AT.glassBorderHover : _AT.glassBorder}`,
                minHeight: 40,
                alignItems: 'center',
                cursor: 'text',
                transition: 'border-color 0.2s',
            }}
            onClick={() => document.getElementById('pill-input')?.focus()}
        >
            {value.map((tag, i) => (
                <span
                    key={i}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10,
                        padding: '3px 9px',
                        borderRadius: 2,
                        background: `${color}14`,
                        color,
                        border: `1px solid ${color}28`,
                        fontFamily: _AT.fontMono,
                        animation: 'scaleIn 0.2s ease backwards',
                    }}
                >
                    {tag}
                    <button
                        onClick={() => remove(tag)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            opacity: 0.7,
                        }}
                    >
                        <X size={10} />
                    </button>
                </span>
            ))}
            <input
                id="pill-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        add();
                    }
                    if (e.key === 'Backspace' && !input && value.length) remove(value[value.length - 1]);
                }}
                placeholder={value.length === 0 ? placeholder : ''}
                style={{
                    background: 'none',
                    border: 'none',
                    color: _AT.textMain,
                    fontSize: 11,
                    outline: 'none',
                    fontFamily: _AT.fontMono,
                    minWidth: 100,
                    flex: 1,
                }}
            />
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  25. SLIDER — Neon range input
// ═══════════════════════════════════════════════════════════════════════════
export const NeonSlider = ({
    value,
    min = 0,
    max = 100,
    step = 1,
    onChange,
    label,
    color = _AT.primary,
    showValue = true,
}) => {
    injectKeyframes();
    const pct = ((value - min) / (max - min)) * 100;

    return (
        <div>
            {(label || showValue) && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        fontSize: 10,
                        fontFamily: _AT.fontMono,
                    }}
                >
                    {label && <span style={{ color: _AT.textMuted }}>{label}</span>}
                    {showValue && <span style={{ color, fontWeight: 700 }}>{value}</span>}
                </div>
            )}
            <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
                {/* Track */}
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: 4,
                        borderRadius: 2,
                        background: _AT.glassBorder,
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: color,
                            transition: 'width 0.1s ease',
                            borderRadius: 2,
                        }}
                    />
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    style={{
                        position: 'absolute',
                        width: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        height: 20,
                        zIndex: 2,
                    }}
                />
                {/* Thumb */}
                <div
                    style={{
                        position: 'absolute',
                        left: `${pct}%`,
                        transform: 'translateX(-50%)',
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: color,
                        boxShadow: `0 0 10px ${color}, 0 0 20px ${color}60`,
                        pointerEvents: 'none',
                        transition: 'left 0.1s ease',
                        border: '2px solid rgba(0,0,0,0.5)',
                    }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 4,
                    fontSize: 8,
                    color: _AT.textDim,
                    fontFamily: _AT.fontMono,
                }}
            >
                <span>{min}</span>
                <span>{max}</span>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  26. TOGGLE SWITCH — Neon style
// ═══════════════════════════════════════════════════════════════════════════
export const NeonToggle = ({ value, onChange, label, color = _AT.primary, size = 'default', disabled = false }) => {
    injectKeyframes();
    const sm = size === 'small';
    const w = sm ? 32 : 42,
        h = sm ? 18 : 24,
        th = sm ? 12 : 18;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: disabled ? 0.4 : 1 }}>
            <div
                onClick={() => !disabled && onChange(!value)}
                style={{
                    width: w,
                    height: h,
                    borderRadius: h,
                    position: 'relative',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: value ? `${color}30` : _AT.glass,
                    border: `1px solid ${value ? color + '60' : _AT.glassBorder}`,
                    boxShadow: value ? `0 0 12px ${color}30, inset 0 0 8px ${color}10` : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: (h - th) / 2,
                        width: th,
                        height: th,
                        borderRadius: '50%',
                        background: value ? color : _AT.textDim,
                        left: value ? w - th - (h - th) / 2 : (h - th) / 2,
                        boxShadow: value ? `0 0 8px ${color}, 0 0 16px ${color}60` : 'none',
                        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    }}
                />
            </div>
            {label && (
                <span style={{ fontSize: sm ? 10 : 11, color: _AT.textMuted, fontFamily: _AT.fontBody }}>{label}</span>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  27. SELECT DROPDOWN — Neural styled
// ═══════════════════════════════════════════════════════════════════════════
export const NeuralSelect = ({ value, options, onChange, label, color = _AT.primary, disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [hovered, hoverProps] = useHover();
    const selected = options.find((o) => (typeof o === 'string' ? o : o.value) === value);
    const selectedLabel = selected ? (typeof selected === 'string' ? selected : selected.label) : 'Select...';

    return (
        <div style={{ position: 'relative' }}>
            {label && (
                <div
                    style={{
                        fontSize: 9,
                        color: _AT.textMuted,
                        fontFamily: _AT.fontDisplay,
                        letterSpacing: '1.5px',

                        marginBottom: 6,
                    }}
                >
                    {label}
                </div>
            )}
            <div
                {...hoverProps}
                onClick={() => !disabled && setOpen(!open)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: open ? `${color}08` : _AT.shadowMd,
                    border: `1px solid ${open || hovered ? color + '40' : _AT.glassBorder}`,
                    transition: 'all 0.2s',
                    opacity: disabled ? 0.5 : 1,
                }}
            >
                <span style={{ fontSize: 12, color: _AT.textMain, fontFamily: _AT.fontBody }}>{selectedLabel}</span>
                <ChevronDown
                    size={13}
                    color={_AT.textMuted}
                    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
                />
            </div>
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '100%',
                        marginTop: 4,
                        zIndex: 100,
                        background: 'rgba(2,6,20,0.98)',
                        borderRadius: '10px',
                        border: `1px solid ${_AT.glassBorderHover}`,
                        boxShadow: `0 8px 32px rgba(0,0,0,0.8), 0 0 20px ${color}10`,
                        overflow: 'hidden',
                        animation: 'fadeDown 0.15s ease backwards',
                    }}
                >
                    {options.map((opt, i) => {
                        const key = typeof opt === 'string' ? opt : opt.value;
                        const lbl = typeof opt === 'string' ? opt : opt.label;
                        const isActive = key === value;
                        return (
                            <div
                                key={i}
                                onClick={() => {
                                    onChange(key);
                                    setOpen(false);
                                }}
                                style={{
                                    padding: '9px 14px',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    color: isActive ? color : _AT.textMuted,
                                    background: isActive ? `${color}08` : 'transparent',
                                    borderLeft: `2px solid ${isActive ? color : 'transparent'}`,
                                    fontFamily: _AT.fontBody,
                                    transition: 'all 0.1s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                {isActive && <Check size={11} />}
                                {lbl}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  28. PULSE RING — Radial indicator
// ═══════════════════════════════════════════════════════════════════════════
export const PulseRing = ({ value, max, color = _AT.primary, size = 80, label }) => {
    injectKeyframes();
    const pct = Math.min((value / (max || 1)) * 100, 100);
    const r = size / 2 - 8;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <div
            style={{
                position: 'relative',
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={_AT.grid} strokeWidth={5} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 5px ${color})` }}
                />
            </svg>
            <div style={{ textAlign: 'center', position: 'relative' }}>
                <div
                    style={{
                        fontSize: size < 60 ? 11 : 14,
                        fontWeight: 800,
                        color,
                        fontFamily: _AT.fontMono,
                        lineHeight: 1,
                    }}
                >
                    {value}
                </div>
                {label && (
                    <div
                        style={{
                            fontSize: 7,
                            color: _AT.textDim,
                            fontFamily: _AT.fontMono,
                            marginTop: 1,
                            letterSpacing: '0.5px',
                        }}
                    >
                        {label}
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  29. HEAT CELL + CONNECTION POOL BAR + SETTING ROW (carried over + enhanced)
// ═══════════════════════════════════════════════════════════════════════════
export const HeatCell = ({ value, max, color = _AT.primary, size = 24, label }) => {
    const intensity = Math.min(value / (max || 1), 1);
    const [hovered, hoverProps] = useHover();
    const rgbMap = {
        [_AT.primary]: '99,102,241',
        [_AT.danger]: '255,45,120',
        [_AT.success]: '16,185,129',
        [_AT.warning]: '255,170,0',
    };
    const rgb = rgbMap[color] || '99,102,241';
    return (
        <div
            {...hoverProps}
            title={label || String(value)}
            style={{
                width: size,
                height: size,
                borderRadius: 2,
                background: intensity > 0 ? `rgba(${rgb}, ${intensity * 0.85})` : 'rgba(255,255,255,0.025)',
                border: `1px solid rgba(255,255,255,${intensity * 0.1 + 0.02})`,
                cursor: 'default',
                transition: 'all 0.25s',
                transform: hovered ? 'scale(1.3)' : 'none',
                boxShadow: intensity > 0.5 ? `0 0 ${intensity * 14}px rgba(${rgb},0.7)` : 'none',
                zIndex: hovered ? 10 : 1,
                position: 'relative',
            }}
        />
    );
};

export const ConnectionPoolBar = ({ total, idle, active, waiting, max }) => {
    const segments = [
        { label: 'Active', value: active || total - idle, color: _AT.primary },
        { label: 'Idle', value: idle, color: _AT.success },
        { label: 'Waiting', value: waiting || 0, color: _AT.warning },
    ];
    const barMax = max || total || 1;
    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    height: 18,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: _AT.glass,
                    border: `1px solid ${_AT.glassBorder}`,
                    gap: 1,
                }}
            >
                {segments.map(
                    (seg, i) =>
                        seg.value > 0 && (
                            <div
                                key={i}
                                style={{
                                    width: `${(seg.value / barMax) * 100}%`,
                                    background: `linear-gradient(180deg, ${seg.color}80, ${seg.color}50)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 9,
                                    color: _AT.textMain,
                                    fontWeight: 700,
                                    fontFamily: _AT.fontMono,
                                    transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    minWidth: 2,
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        opacity: 0.2,
                                        background: `repeating-linear-gradient(90deg, transparent, transparent 5px, ${seg.color}20 5px, ${seg.color}20 6px)`,
                                    }}
                                />
                                <span style={{ position: 'relative', zIndex: 1 }}>
                                    {seg.value > 3 ? seg.value : ''}
                                </span>
                            </div>
                        ),
                )}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {segments.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: 1,
                                background: seg.color,
                            }}
                        />
                        <span style={{ fontSize: 10, color: _AT.textMuted, fontFamily: _AT.fontMono }}>
                            {seg.label}: <span style={{ color: _AT.textMain, fontWeight: 700 }}>{seg.value}</span>
                        </span>
                    </div>
                ))}
                {max && (
                    <span style={{ fontSize: 10, color: _AT.textDim, marginLeft: 'auto', fontFamily: _AT.fontMono }}>
                        max: {max}
                    </span>
                )}
            </div>
        </div>
    );
};

export const SettingRow = ({ name, value, unit, description, category, context, onChange, type = 'text' }) => {
    const [hovered, hoverProps] = useHover();
    return (
        <div
            {...hoverProps}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderBottom: `1px solid ${_AT.glassBorder}`,
                background: hovered ? 'rgba(0,245,255,0.015)' : 'transparent',
                transition: 'background 0.15s',
                animation: 'fadeUp 0.3s ease backwards',
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 12, fontFamily: _AT.fontMono, color: _AT.primary, fontWeight: 600 }}>
                        {name}
                    </span>
                    {context && (
                        <span
                            style={{
                                fontSize: 8,
                                background: _AT.glass,
                                padding: '1px 6px',
                                borderRadius: 2,
                                color: _AT.textDim,
                                fontFamily: _AT.fontMono,
                            }}
                        >
                            {context}
                        </span>
                    )}
                </div>
                {description && (
                    <div style={{ fontSize: 10, color: _AT.textMuted, marginTop: 2, fontFamily: _AT.fontBody }}>
                        {description}
                    </div>
                )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {type === 'toggle' ? (
                    <NeonToggle value={!!value} onChange={onChange} size="small" />
                ) : (
                    <>
                        <span style={{ fontSize: 14, fontFamily: _AT.fontMono, color: _AT.textMain, fontWeight: 700 }}>
                            {value}
                        </span>
                        {unit && (
                            <span style={{ fontSize: 10, color: _AT.textDim, marginLeft: 5, fontFamily: _AT.fontMono }}>
                                {unit}
                            </span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  30. ROLE & WEBSOCKET STATUS (carried over + enhanced)
// ═══════════════════════════════════════════════════════════════════════════
const ROLE_CONFIG = {
    super_admin: { color: _AT.warning, icon: ShieldCheck, label: 'SUPER ADMIN' },
    dba: { color: _AT.primary, icon: Shield, label: 'DBA' },
    developer: { color: _AT.ai, icon: Code, label: 'DEVELOPER' },
    analyst: { color: _AT.success, icon: BarChart2, label: 'ANALYST' },
    viewer: { color: _AT.textMuted, icon: Eye, label: 'VIEWER' },
};

export const RoleBadge = ({ role, showIcon = true, size = 'default' }) => {
    const config = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;
    const Icon = config.icon;
    const sm = size === 'small';
    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: sm ? 4 : 6,
                background: `${config.color}10`,
                padding: sm ? '2px 8px' : '5px 12px',
                borderRadius: '10px',
                border: `1px solid ${config.color}22`,
            }}
        >
            {showIcon && <Icon size={sm ? 10 : 13} color={config.color} />}
            <span
                style={{
                    fontSize: sm ? 9 : 10,
                    fontWeight: 800,
                    color: config.color,

                    letterSpacing: '1px',
                    fontFamily: _AT.fontDisplay,
                }}
            >
                {config.label}
            </span>
        </div>
    );
};

export const WebSocketStatus = ({ connected, clientCount, lastMessage, uptime, quality }) => {
    injectKeyframes();
    const color = connected ? _AT.success : _AT.danger;
    const qualColors = { high: _AT.success, medium: _AT.warning, low: _AT.danger };
    const qColor = quality ? qualColors[quality] || color : color;
    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: `${qColor}05`,
                padding: '6px 14px',
                borderRadius: 2,
                border: `1px solid ${qColor}20`,
            }}
        >
            {connected ? <Wifi size={12} color={qColor} /> : <WifiOff size={12} color={qColor} />}
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: qColor }} />
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: qColor,
                    fontFamily: _AT.fontDisplay,
                    letterSpacing: '1px',
                }}
            >
                {connected ? 'WS·CONNECTED' : 'WS·OFFLINE'}
            </span>
            {clientCount !== undefined && (
                <span
                    style={{
                        fontSize: 9,
                        fontFamily: _AT.fontMono,
                        color: _AT.textMuted,
                        background: _AT.glass,
                        padding: '1px 7px',
                        borderRadius: 2,
                    }}
                >
                    {clientCount}c
                </span>
            )}
            {uptime && <span style={{ fontSize: 9, color: _AT.textDim, fontFamily: _AT.fontMono }}>{uptime}</span>}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  31. NODE LINK (enhanced) + SEQUENCE USAGE + EXTENSION CARD
// ═══════════════════════════════════════════════════════════════════════════
export const NodeLink = ({ from, to, type = 'depends', latency, status = 'active', bidirectional = false }) => {
    const color =
        { active: _AT.success, degraded: _AT.warning, error: _AT.danger, idle: _AT.textMuted }[status] || _AT.success;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontFamily: _AT.fontMono, fontSize: 11 }}>
            <span
                style={{
                    color: _AT.textMuted,
                    background: _AT.glass,
                    padding: '4px 10px',
                    borderRadius: '3px 0 0 3px',
                    border: `1px solid ${_AT.glassBorder}`,
                }}
            >
                {from}
            </span>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 6px',
                    background: `${color}08`,
                    border: `1px solid ${color}20`,
                    borderLeft: 'none',
                    borderRight: 'none',
                    height: 29,
                    gap: 2,
                }}
            >
                {bidirectional && (
                    <div
                        style={{
                            width: 0,
                            height: 0,
                            borderTop: '4px solid transparent',
                            borderBottom: '4px solid transparent',
                            borderRight: `6px solid ${color}60`,
                        }}
                    />
                )}
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                <div style={{ width: 36, height: 1, background: `linear-gradient(90deg, ${color}, ${color}50)` }} />
                {latency && <span style={{ fontSize: 8, color, padding: '0 2px' }}>{latency}ms</span>}
                <div style={{ width: 18, height: 1, background: `linear-gradient(90deg, ${color}50, ${color})` }} />
                <div
                    style={{
                        width: 0,
                        height: 0,
                        borderTop: '4px solid transparent',
                        borderBottom: '4px solid transparent',
                        borderLeft: `6px solid ${color}`,
                    }}
                />
            </div>
            <span
                style={{
                    color: _AT.textMuted,
                    background: _AT.glass,
                    padding: '4px 10px',
                    borderRadius: '0 3px 3px 0',
                    border: `1px solid ${_AT.glassBorder}`,
                    borderLeft: 'none',
                }}
            >
                {to}
            </span>
        </div>
    );
};

export const SequenceUsageBar = ({ name, usagePct, lastValue, maxValue, cycle }) => (
    <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontFamily: _AT.fontMono, color: _AT.textMuted }}>{name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {cycle && <ChipBadge label="CYCLE" color={_AT.success} micro />}
                <span
                    style={{
                        fontSize: 11,
                        fontFamily: _AT.fontMono,
                        fontWeight: 700,
                        color: usagePct > 80 ? _AT.danger : usagePct > 50 ? _AT.warning : _AT.textMuted,
                    }}
                >
                    {usagePct}%
                </span>
            </div>
        </div>
        <NeonProgressBar
            value={usagePct}
            max={100}
            color={usagePct > 80 ? _AT.danger : usagePct > 50 ? _AT.warning : _AT.success}
            height={4}
        />
    </div>
);

export const ExtensionCard = ({ name, version, schema, description, enabled }) => {
    const [hovered, hoverProps] = useHover();
    return (
        <div
            {...hoverProps}
            style={{
                background: hovered ? 'rgba(10,20,40,0.8)' : 'rgba(4,9,28,0.6)',
                borderRadius: '10px',
                border: `1px solid ${hovered ? _AT.glassBorderHover : _AT.glassBorder}`,
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.2s',
            }}
        >
            <div
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: '14px',
                    background: `${_AT.primary}08`,
                    color: _AT.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${_AT.primary}20`,
                }}
            >
                <Database size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: _AT.textMain, fontFamily: _AT.fontBody }}>
                        {name}
                    </span>
                    <span
                        style={{
                            fontSize: 9,
                            background: _AT.grid,
                            padding: '2px 7px',
                            borderRadius: 2,
                            color: _AT.textMuted,
                            fontFamily: _AT.fontMono,
                        }}
                    >
                        v{version}
                    </span>
                    {enabled !== undefined && (
                        <ChipBadge
                            label={enabled ? 'ACTIVE' : 'DISABLED'}
                            color={enabled ? _AT.success : _AT.textMuted}
                            micro
                            dot={enabled}
                        />
                    )}
                </div>
                {description && (
                    <div
                        style={{
                            fontSize: 11,
                            color: _AT.textMuted,
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {description}
                    </div>
                )}
            </div>
            <span style={{ fontSize: 10, color: _AT.textDim, fontFamily: _AT.fontMono, flexShrink: 0 }}>{schema}</span>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  32. AI AGENT VIEW — v2 Neural cortex
// ═══════════════════════════════════════════════════════════════════════════
export const AIAgentView = ({ type, data, streaming = false }) => {
    const [copied, copy] = useCopyToClipboard();
    const [activeTab, setActiveTab] = useState('analysis');
    const [typedText, done] = useTypewriter(
        type === 'api' ? data?.ai_insight || '' : data?.recommendation || 'Analysis complete.',
        18,
        streaming,
    );

    if (!data)
        return (
            <EmptyState
                icon={TerminalIcon}
                title="AWAITING INPUT"
                text="Select an entity to initiate neural analysis sequence."
            />
        );

    const severityColor = { missing: _AT.danger, unused: _AT.warning, duplicate: _AT.warning }[type] || _AT.primary;
    const tabs = ['analysis', 'context', 'actions', 'metrics'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
            {/* AI Header */}
            <div
                style={{
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(123,47,255,0.05) 100%)',
                    border: `1px solid ${_AT.ai}28`,
                    borderRadius: '14px',
                    padding: 16,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div
                        style={{
                            width: 30,
                            height: 30,
                            background: `linear-gradient(135deg, ${_AT.ai}, #8b5cf6)`,
                            borderRadius: 5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Sparkles size={14} color="white" />
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: _AT.ai,
                                letterSpacing: '1.5px',
                                fontFamily: _AT.fontDisplay,
                            }}
                        >
                            NEURAL ANALYSIS ENGINE v3.0
                        </div>
                        <div style={{ fontSize: 8, color: _AT.textMuted, fontFamily: _AT.fontMono, marginTop: 1 }}>
                            {streaming ? (
                                <TypewriterText text="Processing..." color={_AT.warning} speed={60} />
                            ) : (
                                'confidence: 97.3% · latency: 142ms'
                            )}
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                        {streaming && (
                            <div
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    background: _AT.success,
                                    animation: 'ping 1s ease-out infinite',
                                }}
                            />
                        )}
                        <SeverityBadge
                            severity={
                                type === 'unused'
                                    ? 'warning'
                                    : type === 'missing'
                                      ? 'critical'
                                      : type === 'duplicate'
                                        ? 'warning'
                                        : 'info'
                            }
                        />
                    </div>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.8, color: _AT.textMuted, margin: 0, fontFamily: _AT.fontBody }}>
                    {streaming
                        ? typedText
                        : type === 'api'
                          ? data.ai_insight
                          : data.recommendation || 'No critical issues detected.'}
                    {streaming && !done && (
                        <span
                            style={{
                                borderRight: `2px solid ${_AT.ai}`,
                                animation: 'blink 0.8s step-end infinite',
                                marginLeft: 1,
                            }}
                        />
                    )}
                </p>
            </div>

            {/* Tabs */}
            <div
                style={{
                    display: 'flex',
                    gap: 2,
                    background: _AT.glass,
                    padding: 3,
                    borderRadius: '14px',
                    border: `1px solid ${_AT.glassBorder}`,
                }}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            background: activeTab === tab ? `${_AT.primary}14` : 'none',
                            border: activeTab === tab ? `1px solid ${_AT.primary}30` : '1px solid transparent',
                            color: activeTab === tab ? _AT.primary : _AT.textMuted,
                            padding: '5px 0',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: 8,
                            fontWeight: 700,

                            letterSpacing: '1px',
                            fontFamily: _AT.fontDisplay,
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Terminal */}
            <div
                style={{
                    flex: 1,
                    background: _AT.deepTeal,
                    borderRadius: '14px',
                    border: `1px solid ${_AT.glassBorder}`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    minHeight: 160,
                }}
            >
                <ScanlineOverlay opacity={0.012} />
                <div
                    style={{
                        background: _AT.bg,
                        padding: '7px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: `1px solid ${_AT.glassBorder}`,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {[_AT.danger, _AT.warning, _AT.success].map((c, i) => (
                            <div
                                key={i}
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: c,
                                }}
                            />
                        ))}
                        <span style={{ fontSize: 10, color: _AT.textMuted, fontFamily: _AT.fontMono, marginLeft: 6 }}>
                            neural://analysis.context
                        </span>
                    </div>
                    <CopyButton size="small" text={data.problem_query || data.recommendation || ''} />
                </div>
                <div
                    style={{
                        padding: 14,
                        fontFamily: _AT.fontMono,
                        fontSize: 11,
                        color: _AT.info,
                        lineHeight: 1.9,
                        flex: 1,
                        overflowY: 'auto',
                    }}
                >
                    {type === 'missing' && (
                        <>
                            <div style={{ color: _AT.textDim }}>{`-- ✦ RECOMMENDED ACTION`}</div>
                            <div
                                style={{ color: _AT.success, marginTop: 2 }}
                            >{`CREATE INDEX CONCURRENTLY idx_${data.table}_${data.column}`}</div>
                            <div style={{ color: _AT.success }}>{`ON ${data.table} (${data.column});`}</div>
                            <div style={{ color: _AT.textDim, marginTop: 8 }}>{`-- ✦ PROJECTED IMPACT`}</div>
                            <div style={{ color: _AT.primary }}>{`Est. speedup: ${data.improvement || '~10x'}`}</div>
                        </>
                    )}
                    {type === 'unused' && (
                        <>
                            <div style={{ color: _AT.textDim }}>{`-- ✦ SAFE TO REMOVE`}</div>
                            <div
                                style={{ color: _AT.danger, marginTop: 2 }}
                            >{`DROP INDEX CONCURRENTLY ${data.indexName};`}</div>
                            <div style={{ color: _AT.textDim, marginTop: 8 }}>{`-- ✦ RESOURCES FREED`}</div>
                            <div style={{ color: _AT.warning }}>{`Disk: ${data.size} · Last scan: never`}</div>
                        </>
                    )}
                    {type === 'api' &&
                        data.queries?.map((q, i) => (
                            <div key={i} style={{ marginBottom: 12 }}>
                                <div
                                    style={{ color: _AT.textDim, fontSize: 10 }}
                                >{`-- [${i + 1}] ${q.calls} calls · ${q.duration}ms avg`}</div>
                                <div style={{ color: _AT.info, marginTop: 4 }}>{q.sql}</div>
                            </div>
                        ))}
                    {!['missing', 'unused', 'api'].includes(type) && (
                        <span style={{ color: _AT.info }}>{data.problem_query || '-- No context available'}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  33. QUERY HISTORY ITEM — v2 Chronostream
// ═══════════════════════════════════════════════════════════════════════════
export const QueryHistoryItem = ({ entry, onFavourite, onTag, onReplay, onCopy }) => {
    const [expanded, setExpanded] = useState(false);
    const [hovered, hoverProps] = useHover();
    return (
        <div
            {...hoverProps}
            style={{
                background: hovered ? 'rgba(7,15,36,0.9)' : 'rgba(4,9,28,0.7)',
                borderRadius: '10px',
                border: `1px solid ${hovered ? _AT.glassBorderHover : _AT.glassBorder}`,
                overflow: 'hidden',
                transition: 'all 0.2s',
                animation: 'fadeUp 0.3s ease backwards',
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: entry.success ? _AT.success : _AT.danger,
                    opacity: 0.6,
                }}
            />
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px 10px 16px',
                    cursor: 'pointer',
                }}
            >
                <span
                    style={{
                        flex: 1,
                        fontSize: 11,
                        color: _AT.textMuted,
                        fontFamily: _AT.fontMono,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {entry.sql}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {entry.tag && <ChipBadge label={entry.tag} color={_AT.primary} micro />}
                    <span
                        style={{
                            fontSize: 10,
                            color: entry.durationMs > 1000 ? _AT.warning : _AT.textMuted,
                            fontFamily: _AT.fontMono,
                            fontWeight: 700,
                        }}
                    >
                        {entry.durationMs}ms
                    </span>
                    <span style={{ fontSize: 9, color: _AT.textDim, fontFamily: _AT.fontMono }}>{entry.rowCount}r</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onFavourite?.(entry.id);
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 2,
                            color: entry.favourite ? _AT.warning : _AT.textDim,
                            transition: 'color 0.2s',
                            display: 'flex',
                        }}
                    >
                        {entry.favourite ? <Star size={12} fill={_AT.warning} /> : <Star size={12} />}
                    </button>
                    <ChevronDown
                        size={11}
                        color={_AT.textDim}
                        style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}
                    />
                </div>
            </div>
            {expanded && (
                <div style={{ padding: '0 16px 14px 16px', borderTop: `1px solid ${_AT.glassBorder}` }}>
                    <pre
                        style={{
                            fontSize: 11,
                            color: _AT.info,
                            fontFamily: _AT.fontMono,
                            background: _AT.deepTeal,
                            padding: 12,
                            borderRadius: '10px',
                            margin: '10px 0',
                            overflowX: 'auto',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            border: `1px solid ${_AT.glassBorder}`,
                        }}
                    >
                        {entry.sql}
                    </pre>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 10,
                            color: _AT.textMuted,
                            fontFamily: _AT.fontMono,
                        }}
                    >
                        <div style={{ display: 'flex', gap: 12 }}>
                            {entry.user && (
                                <span>
                                    user: <span style={{ color: _AT.textMuted }}>{entry.user}</span>
                                </span>
                            )}
                            <span>{new Date(entry.ts).toLocaleString()}</span>
                            {entry.error && <span style={{ color: _AT.danger }}>✕ {entry.error}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                            {onCopy && (
                                <NanoButton
                                    icon={Copy}
                                    onClick={() => onCopy(entry.sql)}
                                    tooltip="Copy SQL"
                                    size="small"
                                />
                            )}
                            {onReplay && (
                                <NanoButton
                                    icon={RefreshCw}
                                    onClick={() => onReplay(entry.sql)}
                                    tooltip="Replay"
                                    size="small"
                                />
                            )}
                            {onTag && (
                                <NanoButton icon={Tag} onClick={() => onTag(entry.id)} tooltip="Tag" size="small" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  34. CACHE STATS RING + BLOAT BADGE (enhanced)
// ═══════════════════════════════════════════════════════════════════════════
export const CacheStatsRing = ({ size: cacheSize, maxSize, hitRate }) => {
    const usagePct = maxSize ? (cacheSize / maxSize) * 100 : 0;
    const data = [
        { name: 'Used', value: cacheSize, fill: _AT.primary },
        { name: 'Free', value: maxSize - cacheSize, fill: _AT.grid },
    ];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 100, height: 100, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={28}
                            outerRadius={44}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((e, i) => (
                                <Cell key={i} fill={e.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: _AT.primary,
                            fontFamily: _AT.fontMono,
                            textShadow: `0 0 10px ${_AT.primary}80`,
                        }}
                    >
                        {usagePct.toFixed(0)}%
                    </span>
                </div>
            </div>
            <div>
                <div
                    style={{
                        fontSize: 9,
                        color: _AT.textMuted,
                        marginBottom: 6,
                        fontFamily: _AT.fontDisplay,
                        letterSpacing: '1px',
                    }}
                >
                    App Cache
                </div>
                <div
                    style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: _AT.textMain,
                        fontFamily: _AT.fontMono,
                        lineHeight: 1,
                    }}
                >
                    {cacheSize}
                    <span style={{ fontSize: 12, color: _AT.textMuted }}>/{maxSize}</span>
                </div>
                {hitRate !== undefined && (
                    <div style={{ fontSize: 11, color: _AT.success, marginTop: 6, fontFamily: _AT.fontMono }}>
                        ↑ {hitRate}% hit rate
                    </div>
                )}
            </div>
        </div>
    );
};

export const BloatStatusBadge = ({ status, bloatPct }) => {
    const config = {
        critical: { color: _AT.danger, icon: XCircle },
        warning: { color: _AT.warning, icon: AlertTriangle },
        ok: { color: _AT.success, icon: CheckCircle },
    }[status] || { color: _AT.textMuted, icon: Info };
    const Icon = config.icon;
    return (
        <div
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: `${config.color}10`,
                padding: '3px 10px',
                borderRadius: '10px',
                border: `1px solid ${config.color}25`,
            }}
        >
            <Icon size={11} color={config.color} />
            <span
                style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: config.color,

                    letterSpacing: '1px',
                    fontFamily: _AT.fontDisplay,
                }}
            >
                {status}
            </span>
            {bloatPct !== undefined && (
                <span style={{ fontSize: 10, fontFamily: _AT.fontMono, color: config.color }}>{bloatPct}%</span>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  35. BENTO METRIC — v2
// ═══════════════════════════════════════════════════════════════════════════
export const BentoMetric = ({
    label,
    value,
    unit,
    icon: Icon,
    color,
    trend,
    delay = 0,
    chartData,
    description,
    onClick,
}) => {
    injectKeyframes();
    const [hovered, hoverProps] = useHover();
    return (
        <div
            {...hoverProps}
            onClick={onClick}
            style={{
                background: _AT.surface,
                borderRadius: '14px',
                padding: 20,
                border: `1px solid ${_AT.glassBorder}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                animation: `fadeUp 0.4s ease ${delay}s backwards`,
                position: 'relative',
                overflow: 'hidden',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                transform: hovered ? 'translateY(-1px)' : 'none',
                boxShadow: hovered ? _AT.shadowMd : _AT.shadowSm || '0 1px 3px rgba(0,0,0,0.08)',
                minHeight: 140,
                cursor: onClick ? 'pointer' : 'default',
            }}
        >
            {chartData && chartData.length > 0 && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 55, opacity: 0.1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={color}
                                fill={color}
                                strokeWidth={1}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                    style={{
                        padding: 8,
                        borderRadius: '10px',
                        background: `${color}12`,
                        color,
                    }}
                >
                    <Icon size={15} />
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: _AT.textMuted,
                        fontWeight: 500,
                    }}
                >
                    {label}
                </span>
            </div>
            <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <span
                        style={{
                            fontSize: 30,
                            fontWeight: 700,
                            lineHeight: 1,
                            fontFamily: _AT.fontMono,
                            color: _AT.textMain,
                            letterSpacing: '-0.03em',
                        }}
                    >
                        {value}
                    </span>
                    {unit && (
                        <span style={{ fontSize: 13, color: _AT.textMuted, marginBottom: 3, fontFamily: _AT.fontMono }}>
                            {unit}
                        </span>
                    )}
                </div>
                {description && <div style={{ fontSize: 11, color: _AT.textMuted, marginTop: 4 }}>{description}</div>}
                {trend !== undefined && trend !== null && (
                    <div style={{ marginTop: 8 }}>
                        <TrendChip value={trend} label="vs last hr" />
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  TERMINAL LINE (kept from v1 + enhanced)
// ═══════════════════════════════════════════════════════════════════════════
export const TerminalLine = ({ prompt = '$', command, output, color = _AT.primary, delay = 0, type = 'default' }) => {
    injectKeyframes();
    const prompts = {
        default: { sym: '$', color: _AT.success },
        error: { sym: '✕', color: _AT.danger },
        success: { sym: '✓', color: _AT.success },
        system: { sym: '⬡', color: _AT.warning },
    };
    const p = prompts[type] || prompts.default;
    return (
        <div
            style={{
                fontFamily: _AT.fontMono,
                fontSize: 12,
                lineHeight: 1.85,
                animation: `fadeUp 0.4s ease ${delay}s backwards`,
            }}
        >
            <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: p.color, userSelect: 'none', flexShrink: 0 }}>{p.sym}</span>
                <span style={{ color: _AT.textMain }}>{command}</span>
            </div>
            {output && <div style={{ color: _AT.textMuted, marginLeft: 18 }}>{output}</div>}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  COMMAND PALETTE ITEM (kept + enhanced)
// ═══════════════════════════════════════════════════════════════════════════
export const CommandPaletteItem = ({
    icon: Icon,
    label,
    description,
    shortcut,
    color = _AT.primary,
    onClick,
    active,
}) => {
    const [hovered, hoverProps] = useHover();
    const isHighlighted = active || hovered;
    return (
        <div
            {...hoverProps}
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: '10px',
                background: isHighlighted ? `${color}08` : 'transparent',
                border: `1px solid ${isHighlighted ? color + '22' : 'transparent'}`,
                borderLeft: `2px solid ${isHighlighted ? color : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
            }}
        >
            {Icon && (
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: '14px',
                        background: `${color}12`,
                        color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${color}20`,
                        flexShrink: 0,
                    }}
                >
                    <Icon size={13} />
                </div>
            )}
            <div style={{ flex: 1 }}>
                <div
                    style={{
                        fontSize: 12,
                        color: isHighlighted ? _AT.textMain : _AT.textMuted,
                        fontFamily: _AT.fontBody,
                        fontWeight: 500,
                    }}
                >
                    {label}
                </div>
                {description && <div style={{ fontSize: 10, color: _AT.textDim, marginTop: 1 }}>{description}</div>}
            </div>
            {shortcut && (
                <kbd
                    style={{
                        fontSize: 9,
                        color: _AT.textDim,
                        background: _AT.glass,
                        border: `1px solid ${_AT.glassBorder}`,
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontFamily: _AT.fontMono,
                    }}
                >
                    {shortcut}
                </kbd>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

/* Toast context for app-wide notifications */
const ToastContext = createContext({});
export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random();
        const toast = {
            id,
            message,
            type, // 'success' | 'error' | 'warning' | 'info'
            duration,
            timestamp: Date.now(),
        };

        setToasts((prev) => [...prev, toast]);

        if (duration > 0) {
            const timer = setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
            return { id, clear: () => clearTimeout(timer) };
        }
        return { id, clear: () => setToasts((prev) => prev.filter((t) => t.id !== id)) };
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer = ({ toasts, onRemove }) => {
    injectKeyframes();

    const getToastStyle = (type) => {
        const baseStyles = {
            success: {
                bg: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                icon: CheckCircle,
                color: _AT.success,
            },
            error: {
                bg: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                icon: XCircle,
                color: _AT.danger,
            },
            warning: {
                bg: 'rgba(251, 146, 60, 0.1)',
                border: '1px solid rgba(251, 146, 60, 0.3)',
                icon: AlertTriangle,
                color: _AT.warning,
            },
            info: {
                bg: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                icon: Info,
                color: _AT.info,
            },
        };
        return baseStyles[type] || baseStyles.info;
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 600,
                pointerEvents: 'none',
                maxWidth: 400,
            }}
        >
            {toasts.map((toast, idx) => {
                const style = getToastStyle(toast.type);
                const Icon = style.icon;
                return (
                    <div
                        key={toast.id}
                        style={{
                            animation: 'fadeUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                            animationDelay: `${idx * 0.05}s`,
                            marginBottom: 12,
                            pointerEvents: 'auto',
                        }}
                    >
                        <div
                            style={{
                                background: style.bg,
                                border: style.border,
                                borderRadius: '12px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                boxShadow: `0 8px 24px rgba(0, 0, 0, 0.25), inset 0 0.5px 0 rgba(255,255,255,0.1)`,
                                fontFamily: _AT.fontBody,
                                fontSize: 13,
                                color: _AT.textMain,
                            }}
                        >
                            <Icon size={18} color={style.color} strokeWidth={2} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{toast.message}</span>
                            <button
                                onClick={() => onRemove(toast.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: _AT.textMuted,
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                                aria-label="Close notification"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  BREADCRUMB NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
export const Breadcrumbs = ({ items, onNavigate }) => {
    injectKeyframes();

    return (
        <nav
            aria-label="Breadcrumb"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                fontSize: 12,
                color: _AT.textMuted,
                borderBottom: `1px solid ${_AT.grid}`,
                background: _AT.shadowMd,
                fontFamily: _AT.fontMono,
            }}
        >
            {items.map((item, idx) => (
                <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {idx > 0 && <ChevronRight size={12} style={{ opacity: 0.4 }} />}
                    <button
                        onClick={() => onNavigate && onNavigate(item.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: onNavigate ? 'pointer' : 'default',
                            color: idx === items.length - 1 ? _AT.primary : _AT.textMuted,
                            fontWeight: idx === items.length - 1 ? 600 : 400,
                            transition: 'color 0.15s ease',
                            textDecoration: 'none',
                            fontFamily: _AT.fontMono,
                            fontSize: 12,
                            padding: '2px 4px',
                            borderRadius: '14px',
                        }}
                        onMouseEnter={(e) => {
                            if (idx !== items.length - 1 && onNavigate) {
                                e.currentTarget.style.color = _AT.primary;
                                e.currentTarget.style.background = `${_AT.primary}10`;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (idx !== items.length - 1) {
                                e.currentTarget.style.color = _AT.textMuted;
                                e.currentTarget.style.background = 'none';
                            }
                        }}
                    >
                        {item.label}
                    </button>
                </div>
            ))}
        </nav>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  SKELETON LOADING PLACEHOLDER
// ═══════════════════════════════════════════════════════════════════════════
export const SkeletonCard = ({ width = '100%', height = 200 }) => {
    injectKeyframes();

    return (
        <div
            style={{
                width,
                height,
                borderRadius: '12px',
                background:
                    'linear-gradient(90deg, rgba(0, 245, 255, 0.05) 0%, rgba(123, 47, 255, 0.05) 50%, rgba(0, 245, 255, 0.05) 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite',
                border: `1px solid ${_AT.grid}`,
            }}
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  PROGRESS INDICATOR (for data fetches)
// ═══════════════════════════════════════════════════════════════════════════
export const ProgressBar = ({ progress = 0, isVisible = true }) => {
    injectKeyframes();

    if (!isVisible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                height: 2,
                width: `${progress * 100}%`,
                background: `linear-gradient(90deg, ${_AT.primary}, ${_AT.secondary}, ${_AT.danger})`,
                backgroundSize: '200% 100%',
                animation: 'waveFlow 2s ease-in-out infinite',
                zIndex: 500,
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 10px rgba(0, 245, 255, 0.6)`,
            }}
        />
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  EXPORT MANIFEST
// ═══════════════════════════════════════════════════════════════════════════
export default {
    // Core
    THEME,
    injectKeyframes,
    NeuralProvider,
    useNeural,
    // Hooks
    useAnimatedValue,
    useCopyToClipboard,
    useHover,
    useTypewriter,
    useInterval,
    useCountdown,
    usePrevious,
    // Primitives
    CornerBrackets,
    ScanlineOverlay,
    HexPattern,
    GridPattern,
    GlowOrb,
    NoiseTexture,
    CircuitLines,
    // Badges & chips
    ChipBadge,
    TrendChip,
    SeverityBadge,
    RoleBadge,
    LiveStatusBadge,
    StatusDot,
    WebSocketStatus,
    BloatStatusBadge,
    // Cards
    GlassCard,
    MetricCard,
    BentoMetric,
    StatCompare,
    ExtensionCard,
    // Charts & viz
    ResourceGauge,
    NeonProgressBar,
    CacheStatsRing,
    PulseRing,
    HeatCell,
    ConnectionPoolBar,
    RadarMetric,
    NetworkGraph,
    WaveformBar,
    HeatmapGrid,
    // Alerts
    AlertBanner,
    AlertToast,
    // Table & data
    DataTable,
    FilterPills,
    Timeline,
    // Inputs
    NanoButton,
    MiniButton,
    CopyButton,
    NeonSlider,
    NeonToggle,
    NeuralSelect,
    PillInput,
    // Terminal
    Terminal,
    TerminalLine,
    TypewriterText,
    // Overlay
    LoadingOverlay,
    SkeletonLoader,
    EmptyState,
    // Advanced
    AIAgentView,
    QueryHistoryItem,
    CommandPalette,
    CommandPaletteItem,
    NodeLink,
    SequenceUsageBar,
    SettingRow,
    // UX Improvements
    ToastProvider,
    useToast,
    ToastContainer,
    Breadcrumbs,
    SkeletonCard,
    ProgressBar,
};
