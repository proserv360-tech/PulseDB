import React, { useState, useEffect, useRef } from 'react';
import {
    Database,
    Activity,
    Zap,
    Shield,
    TrendingUp,
    Bell,
    ArrowRight,
    Play,
    CheckCircle,
    BarChart3,
    Search,
    Cpu,
    Server,
    ChevronRight,
    GitBranch,
} from 'lucide-react';
import ByProserv360 from '../components/ui/ByProserv360';
import { THEME } from '../utils/theme';

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────
interface LandingPageProps {
    onEnterDemo?: () => void;
    onLogin?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mini Sparkline SVG
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({
    data,
    color,
    width = 80,
    height = 28,
}: {
    data: number[];
    color: string;
    width?: number;
    height?: number;
}) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data
        .map((v, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((v - min) / range) * (height - 4) - 2;
            return `${x},${y}`;
        })
        .join(' ');
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Animated counter
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ target, suffix = '', duration = 1800 }: { target: number; suffix?: string; duration?: number }) {
    const [val, setVal] = useState(0);
    const started = useRef(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !started.current) {
                    started.current = true;
                    const start = performance.now();
                    const step = (now: number) => {
                        const p = Math.min((now - start) / duration, 1);
                        const ease = 1 - Math.pow(1 - p, 3);
                        setVal(Math.round(ease * target));
                        if (p < 1) requestAnimationFrame(step);
                    };
                    requestAnimationFrame(step);
                }
            },
            { threshold: 0.3 },
        );
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [target, duration]);

    return (
        <span ref={ref}>
            {val.toLocaleString()}
            {suffix}
        </span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Live DB preview panel (hero right side)
// ─────────────────────────────────────────────────────────────────────────────
function DBPreviewPanel() {
    const [tick, setTick] = useState(0);
    const [activeQuery, setActiveQuery] = useState(0);

    const kpis = [
        { label: 'QPS', base: 2847, delta: 120, color: THEME.secondary },
        { label: 'P99 ms', base: 12.4, delta: 2.1, color: THEME.ai },
        { label: 'Cache hit', base: 98.7, delta: 0.4, suffix: '%', color: THEME.success },
        { label: 'Connections', base: 143, delta: 8, color: THEME.warning },
    ];

    const queries = [
        {
            engine: 'postgres',
            sql: 'SELECT u.id, u.name, COUNT(o.id) FROM users u LEFT JOIN orders…',
            ms: 2.1,
            calls: 4821,
        },
        {
            engine: 'mysql',
            sql: 'UPDATE sessions SET last_active = NOW() WHERE expires_at > NOW()',
            ms: 0.8,
            calls: 12400,
        },
        {
            engine: 'mongodb',
            sql: 'db.products.find({ category_id: 42 }).sort({ rank: -1 }).limit(20)',
            ms: 5.3,
            calls: 3201,
        },
        {
            engine: 'sqlserver',
            sql: 'INSERT INTO events (type, payload, created_at) VALUES (@p1, @p2, SYSUTCDATETIME())',
            ms: 1.2,
            calls: 9840,
        },
    ];

    const ENGINE_BADGE: Record<string, { label: string; color: string }> = {
        postgres: { label: 'PG', color: THEME.info },
        mysql: { label: 'MySQL', color: THEME.warning },
        mongodb: { label: 'Mongo', color: THEME.success },
        sqlserver: { label: 'MSSQL', color: THEME.dangerLight },
        oracle: { label: 'Oracle', color: THEME.danger },
    };

    const sparkData = [42, 55, 48, 70, 65, 80, 74, 90, 85, 95, 88, 100];

    useEffect(() => {
        const id = setInterval(() => {
            setTick((t) => t + 1);
            setActiveQuery((q) => (q + 1) % queries.length);
        }, 2200);
        return () => clearInterval(id);
    }, []);

    return (
        <div
            style={{
                width: '100%',
                maxWidth: 520,
                background: THEME.bg,
                border: '1px solid #102552',
                borderRadius: 16,
                overflow: 'hidden',
                fontFamily: THEME.fontMono,
                boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
            }}
        >
            {/* Window chrome */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 16px',
                    background: THEME.inkBlack,
                    borderBottom: '1px solid #102552',
                }}
            >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: THEME.danger }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: THEME.warning }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                <span style={{ marginLeft: 8, fontSize: 11, color: THEME.textDim, letterSpacing: 0.5 }}>
                    pulsedb — production-fleet
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: THEME.secondary,
                            boxShadow: '0 0 6px #22d3ee',
                        }}
                    />
                    <span style={{ fontSize: 10, color: THEME.secondary }}>LIVE</span>
                </div>
            </div>

            {/* KPI row */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4,1fr)',
                    gap: 0,
                    borderBottom: '1px solid #102552',
                }}
            >
                {kpis.map((k, i) => {
                    const noise = Math.sin(tick * 0.7 + i * 1.3) * k.delta;
                    const val = k.base + noise;
                    return (
                        <div
                            key={k.label}
                            style={{ padding: '10px 12px', borderRight: i < 3 ? '1px solid #102552' : 'none' }}
                        >
                            <div
                                style={{
                                    fontSize: 9,
                                    color: THEME.textDim,
                                    letterSpacing: 1,
                                    textTransform: 'uppercase',
                                    marginBottom: 4,
                                }}
                            >
                                {k.label}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: k.color, letterSpacing: -0.5 }}>
                                {k.suffix ? val.toFixed(1) : Math.round(val).toLocaleString()}
                                {k.suffix || ''}
                            </div>
                            <Sparkline
                                data={sparkData.map((v, si) => v + Math.sin(tick * 0.3 + si * 0.4 + i) * 10)}
                                color={k.color}
                                width={70}
                                height={22}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Query list */}
            <div style={{ padding: '12px 0' }}>
                <div
                    style={{
                        padding: '0 14px 8px',
                        fontSize: 9,
                        color: THEME.textDim,
                        letterSpacing: 1,
                        textTransform: 'uppercase',
                        display: 'flex',
                        justifyContent: 'space-between',
                    }}
                >
                    <span>Top Queries</span>
                    <span>calls / avg ms</span>
                </div>
                {queries.map((q, i) => (
                    <div
                        key={i}
                        style={{
                            padding: '6px 14px',
                            background: i === activeQuery ? 'rgba(99,102,241,0.08)' : 'transparent',
                            borderLeft: i === activeQuery ? '2px solid #3b82f6' : '2px solid transparent',
                            transition: 'all 0.4s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        {q.engine && ENGINE_BADGE[q.engine] && (
                            <span
                                style={{
                                    fontSize: 8.5,
                                    fontWeight: 700,
                                    letterSpacing: 0.3,
                                    color: ENGINE_BADGE[q.engine].color,
                                    border: `1px solid ${ENGINE_BADGE[q.engine].color}55`,
                                    borderRadius: 4,
                                    padding: '1px 5px',
                                    flexShrink: 0,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {ENGINE_BADGE[q.engine].label}
                            </span>
                        )}
                        <span
                            style={{
                                fontSize: 10,
                                color: i === activeQuery ? THEME.primaryLight : THEME.textDim,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {q.sql}
                        </span>
                        <span style={{ fontSize: 10, color: THEME.textDim, flexShrink: 0 }}>
                            {q.calls.toLocaleString()} / {q.ms}ms
                        </span>
                    </div>
                ))}
            </div>

            {/* Alert strip */}
            <div
                style={{
                    margin: '0 12px 12px',
                    background: 'rgba(234,179,8,0.06)',
                    border: '1px solid rgba(234,179,8,0.2)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}
            >
                <Bell size={12} color={THEME.warning} />
                <span style={{ fontSize: 10, color: THEME.warningDark }}>
                    Seq scan detected on <strong>orders.user_id</strong> — index recommended
                </span>
                <span
                    style={{
                        marginLeft: 'auto',
                        fontSize: 9,
                        color: THEME.primary,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                    }}
                >
                    Fix →
                </span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Landing Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage({ onEnterDemo, onLogin }: LandingPageProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleDemo = () => {
        if (onEnterDemo) {
            onEnterDemo();
        } else {
            window.dispatchEvent(new CustomEvent('pulsedb:enter-demo'));
        }
    };

    const features = [
        {
            icon: <Activity size={20} color={THEME.primary} />,
            title: 'Real-time Query Analytics',
            desc: 'Live P50/P95/P99 latency, QPS, and query plans — updated every second without polling overhead.',
        },
        {
            icon: <Zap size={20} color={THEME.secondary} />,
            title: 'AI-Powered Advisor',
            desc: 'Automatic index recommendations, slow-query root cause analysis, and one-click EXPLAIN ANALYZE.',
        },
        {
            icon: <Bell size={20} color={THEME.warning} />,
            title: 'Smart Alerting',
            desc: 'Set thresholds on any metric. Get notified via Slack, PagerDuty, or webhook before users notice.',
        },
        {
            icon: <Shield size={20} color={THEME.success} />,
            title: 'Access & Audit Logs',
            desc: 'Full audit trail of who ran what query, when, and from which IP — with role-based access control.',
        },
        {
            icon: <BarChart3 size={20} color={THEME.ai} />,
            title: 'Historical Trends',
            desc: 'Zoom from real-time to 90-day history. Correlate spikes with deploys, traffic, and schema changes.',
        },
        {
            icon: <GitBranch size={20} color={THEME.purple} />,
            title: 'Multi-Database Support',
            desc: 'PostgreSQL, MySQL/MariaDB, MongoDB, Oracle & SQL Server — plus RDS, Aurora, and MongoDB Atlas. One dashboard for your entire fleet.',
        },
    ];

    const stats = [
        { label: 'Queries analyzed', value: 4200000000, suffix: '+' },
        { label: 'Incidents prevented', value: 18400, suffix: '+' },
        { label: 'Avg latency reduction', value: 60, suffix: '%' },
        { label: 'Teams using PulseDB', value: 2100, suffix: '+' },
    ];

    // Fonts injection
    useEffect(() => {
        const id = 'pulsedb-landing-fonts';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href =
                'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700;800;900&display=swap';
            document.head.appendChild(link);
        }
    }, []);

    const font = "'Outfit', sans-serif";
    const mono = "'JetBrains Mono', monospace";

    return (
        <div
            style={{
                background: THEME.inkBlack,
                color: THEME.textMain,
                fontFamily: font,
                minHeight: '100vh',
                overflowX: 'hidden',
            }}
        >
            {/* ── Global styles ── */}
            <style>{`
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #081633; } ::-webkit-scrollbar-thumb { background: #102552; border-radius: 3px; }
                @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                @keyframes orb { 0%,100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.08); } }
                @keyframes fade-up { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes glow-pulse { 0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.6); } }
                .landing-btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease !important; }
                .landing-btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 12px 32px rgba(99,102,241,0.5) !important; }
                .landing-btn-ghost:hover { background: rgba(255,255,255,0.09) !important; border-color: rgba(99,102,241,0.6) !important; color: #fff !important; }
                .feature-card:hover { border-color: rgba(99,102,241,0.4) !important; background: rgba(99,102,241,0.05) !important; transform: translateY(-2px); }
                .feature-card { transition: all 0.2s ease; }
                .stat-card { animation: fade-up 0.6s ease both; }
            `}</style>

            {/* ── NAV ── */}
            <nav
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 40px',
                    height: 60,
                    background: scrolled ? 'rgba(8,11,18,0.92)' : 'transparent',
                    backdropFilter: scrolled ? 'blur(16px)' : 'none',
                    borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                    transition: 'all 0.3s ease',
                }}
            >
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 7,
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Database size={14} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, color: THEME.textMain }}>PulseDB</span>
                    <ByProserv360 height={12} color={THEME.textMuted} style={{ marginLeft: 4 }} />
                </div>

                {/* Nav links */}
                <div style={{ display: 'flex', gap: 28, marginLeft: 40, flex: 1 }}>
                    {['Features', 'Pricing', 'Docs', 'Blog'].map((l) => (
                        <span
                            key={l}
                            style={{ fontSize: 13, color: THEME.textMuted, cursor: 'pointer', fontWeight: 500 }}
                            onMouseEnter={(e) => {
                                (e.target as HTMLElement).style.color = THEME.surfaceRaised;
                            }}
                            onMouseLeave={(e) => {
                                (e.target as HTMLElement).style.color = THEME.textMuted;
                            }}
                        >
                            {l}
                        </span>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        className="landing-btn-ghost"
                        onClick={onLogin}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(148,163,184,0.35)',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: THEME.textMain,
                            padding: '8px 18px',
                            borderRadius: 8,
                            fontFamily: font,
                            fontWeight: 600,
                            transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                        }}
                    >
                        Log in
                    </button>
                    <button
                        className="landing-btn-primary"
                        onClick={handleDemo}
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: 8,
                            fontSize: 13,
                            color: '#fff',
                            padding: '8px 18px',
                            fontFamily: font,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Play size={12} fill="#fff" /> Try Demo
                    </button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section
                style={{
                    position: 'relative',
                    padding: '80px 40px 100px',
                    maxWidth: 1200,
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 64,
                }}
            >
                {/* BG orbs */}
                <div
                    style={{
                        position: 'absolute',
                        top: -40,
                        left: '30%',
                        width: 500,
                        height: 500,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                        animation: 'orb 6s ease-in-out infinite',
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: 100,
                        right: '10%',
                        width: 300,
                        height: 300,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
                        animation: 'orb 8s ease-in-out infinite 2s',
                        pointerEvents: 'none',
                    }}
                />

                {/* Left */}
                <div style={{ flex: 1, minWidth: 0, animation: 'fade-up 0.7s ease both' }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'rgba(99,102,241,0.1)',
                            border: '1px solid rgba(99,102,241,0.25)',
                            borderRadius: 100,
                            padding: '5px 14px',
                            marginBottom: 24,
                        }}
                    >
                        <div
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: THEME.secondary,
                                boxShadow: '0 0 6px #22d3ee',
                            }}
                        />
                        <span
                            style={{
                                fontSize: 11,
                                color: THEME.primaryLight,
                                fontWeight: 600,
                                letterSpacing: 0.5,
                                fontFamily: mono,
                            }}
                        >
                            Now in public beta
                        </span>
                    </div>

                    <h1
                        style={{
                            fontSize: 52,
                            fontWeight: 900,
                            lineHeight: 1.08,
                            letterSpacing: -2,
                            marginBottom: 20,
                            color: THEME.textMain,
                        }}
                    >
                        Multi-database observability
                        <br />
                        <span
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6, #a78bfa, #22d3ee)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            that actually helps.
                        </span>
                    </h1>

                    <p style={{ fontSize: 17, color: THEME.textMuted, lineHeight: 1.65, marginBottom: 36, maxWidth: 480 }}>
                        Real-time query analytics, AI-powered index recommendations, and instant alerting — in one tool
                        built for engineers who care about database performance.
                    </p>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                            className="landing-btn-primary"
                            onClick={handleDemo}
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: 10,
                                fontSize: 15,
                                color: '#fff',
                                padding: '14px 28px',
                                fontFamily: font,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                animation: 'glow-pulse 3s ease-in-out infinite',
                            }}
                        >
                            <Play size={15} fill="#fff" /> Try the live demo
                            <ChevronRight size={15} />
                        </button>
                        <button
                            onClick={onLogin}
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                cursor: 'pointer',
                                borderRadius: 10,
                                fontSize: 15,
                                color: THEME.textMain,
                                padding: '14px 28px',
                                fontFamily: font,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                            }}
                        >
                            Sign in <ArrowRight size={15} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: 20, marginTop: 24, flexWrap: 'wrap' }}>
                        {['No credit card', 'No install', 'Demo in 10 seconds'].map((t) => (
                            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <CheckCircle size={13} color={THEME.success} />
                                <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 500 }}>{t}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right — live preview */}
                <div style={{ flexShrink: 0, animation: 'fade-up 0.7s ease 0.15s both', animationFillMode: 'both' }}>
                    <DBPreviewPanel />
                </div>
            </section>

            {/* ── STATS ── */}
            <section
                style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    padding: '48px 40px',
                }}
            >
                <div
                    style={{
                        maxWidth: 1200,
                        margin: '0 auto',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4,1fr)',
                        gap: 24,
                    }}
                >
                    {stats.map((s, i) => (
                        <div
                            key={s.label}
                            className="stat-card"
                            style={{ textAlign: 'center', animationDelay: `${i * 0.1}s` }}
                        >
                            <div style={{ fontSize: 36, fontWeight: 900, color: THEME.textMain, letterSpacing: -1.5 }}>
                                <Counter target={s.value} suffix={s.suffix} />
                            </div>
                            <div style={{ fontSize: 12, color: THEME.textDim, marginTop: 4, fontWeight: 500 }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div
                        style={{
                            fontSize: 11,
                            color: THEME.primary,
                            letterSpacing: 2,
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            marginBottom: 12,
                            fontFamily: mono,
                        }}
                    >
                        What you get
                    </div>
                    <h2 style={{ fontSize: 36, fontWeight: 800, color: THEME.textMain, letterSpacing: -1 }}>
                        Everything your database team needs
                    </h2>
                    <p style={{ fontSize: 15, color: THEME.textDim, marginTop: 12, maxWidth: 500, margin: '12px auto 0' }}>
                        Built by engineers who've been on-call at 3am staring at an unexplained query spike.
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="feature-card"
                            style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: 12,
                                padding: '24px',
                            }}
                        >
                            <div
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    background: 'rgba(99,102,241,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 14,
                                }}
                            >
                                {f.icon}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                                {f.title}
                            </div>
                            <div style={{ fontSize: 13, color: THEME.textDim, lineHeight: 1.65 }}>{f.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer
                style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    padding: '28px 40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    maxWidth: 1200,
                    margin: '0 auto',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                        style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Database size={11} color="#fff" />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: THEME.textDim }}>PulseDB</span>
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                    {['Privacy', 'Terms', 'Docs', 'Status', 'GitHub'].map((l) => (
                        <span
                            key={l}
                            style={{ fontSize: 12, color: THEME.textMuted, cursor: 'pointer', fontWeight: 500 }}
                            onMouseEnter={(e) => {
                                (e.target as HTMLElement).style.color = THEME.textMuted;
                            }}
                            onMouseLeave={(e) => {
                                (e.target as HTMLElement).style.color = THEME.textMuted;
                            }}
                        >
                            {l}
                        </span>
                    ))}
                </div>
                <span style={{ fontSize: 11, color: THEME.textDim, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    © {new Date().getFullYear()} PulseDB
                    <ByProserv360 height={10} color={THEME.textDim} />
                </span>
            </footer>
        </div>
    );
}
