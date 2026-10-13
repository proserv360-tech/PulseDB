import React, { useState, useEffect, useCallback, useRef } from 'react';
import { THEME } from '../../../utils/theme';
import { useTheme } from '../../../context/ThemeContext';
import {
    Cloud,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Info,
    Cpu,
    Database,
    HardDrive,
    Activity,
    Server,
    ArrowUpDown,
    Clock,
    Plus,
    X,
    ChevronRight,
    Eye,
    EyeOff,
    Shield,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/* ─────────────────────────────────────────────────────────────────
   THEME
   ───────────────────────────────────────────────────────────────── */
const buildTheme = (isDark) => ({
    primary: isDark ? THEME.primary : THEME.primary,
    secondary: isDark ? THEME.primary : THEME.success,
    success: isDark ? THEME.secondaryDark : THEME.success,
    danger: isDark ? THEME.danger : THEME.danger,
    warning: isDark ? THEME.warning : THEME.warning,
    info: isDark ? THEME.info : THEME.primary,
    ai: isDark ? THEME.aiLight : THEME.primary,
    bg: isDark ? THEME.inkBlack : THEME.surface,
    surface: isDark ? THEME.inkBlack : '#ffffff',
    surfaceHover: isDark ? THEME.bgAlt : THEME.surface,
    glass: isDark ? 'rgba(18,10,31,0.65)' : 'rgba(255,255,255,0.85)',
    glassHeavy: isDark ? 'rgba(7,3,13,0.95)' : 'rgba(255,255,255,0.97)',
    glassBorder: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(0,0,0,0.08)',
    textMain: isDark ? THEME.aiLight : THEME.textMain,
    textMuted: isDark ? THEME.textMuted : THEME.textDim,
    textDim: isDark ? THEME.surfaceRaised : THEME.textMuted,
    fontMono: `'JetBrains Mono', 'Fira Code', monospace`,
    fontBody: `'Outfit', system-ui, sans-serif`,
});

/* ── Helpers ── */
const fmt = {
    bytes: (b) => {
        if (b === null) return '—';
        const gb = b / 1073741824;
        if (gb >= 1) return `${gb.toFixed(1)} GB`;
        return `${(b / 1048576).toFixed(0)} MB`;
    },
    pct: (v) => (v === null ? '—' : `${v.toFixed(1)}%`),
    count: (v) => (v === null ? '—' : Math.round(v).toLocaleString()),
    ms: (v) => (v === null ? '—' : `${(v * 1000).toFixed(2)} ms`),
    iops: (v) => (v === null ? '—' : `${v.toFixed(0)} IOPS`),
    mbps: (v) => (v === null ? '—' : `${(v / 1048576).toFixed(2)} MB/s`),
    load: (v) => (v === null ? '—' : v.toFixed(2)),
    time: (ts) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    },
};

const METRIC_DEFS = [
    {
        key: 'CPUUtilization',
        label: 'CPU Utilization',
        unit: '%',
        format: fmt.pct,
        icon: Cpu,
        colorKey: 'primary',
        thresholds: { warn: 70, danger: 90 },
        description: 'Percentage of CPU used',
    },
    {
        key: 'DatabaseConnections',
        label: 'DB Connections',
        unit: 'count',
        format: fmt.count,
        icon: Database,
        colorKey: 'secondary',
        thresholds: null,
        description: 'Active database connections',
    },
    {
        key: 'FreeableMemory',
        label: 'Freeable Memory',
        unit: 'GB',
        format: fmt.bytes,
        icon: Server,
        colorKey: 'success',
        thresholds: null,
        invertColor: true,
        description: 'Available RAM',
    },
    {
        key: 'ReadIOPS',
        label: 'Read IOPS',
        unit: 'IOPS',
        format: fmt.iops,
        icon: HardDrive,
        colorKey: 'info',
        thresholds: null,
        description: 'Read I/O operations per second',
    },
    {
        key: 'WriteIOPS',
        label: 'Write IOPS',
        unit: 'IOPS',
        format: fmt.iops,
        icon: HardDrive,
        colorKey: 'ai',
        thresholds: null,
        description: 'Write I/O operations per second',
    },
    {
        key: 'ReadLatency',
        label: 'Read Latency',
        unit: 'ms',
        format: fmt.ms,
        icon: Clock,
        colorKey: 'warning',
        thresholds: { warn: 0.02, danger: 0.1 },
        description: 'Average read latency',
    },
    {
        key: 'FreeStorageSpace',
        label: 'Free Storage',
        unit: 'GB',
        format: fmt.bytes,
        icon: HardDrive,
        colorKey: 'success',
        thresholds: null,
        invertColor: true,
        description: 'Available storage space',
    },
    {
        key: 'NetworkReceiveThroughput',
        label: 'Network In',
        unit: 'MB/s',
        format: fmt.mbps,
        icon: ArrowUpDown,
        colorKey: 'primary',
        thresholds: null,
        description: 'Incoming network traffic',
    },
    {
        key: 'DBLoad',
        label: 'DB Load',
        unit: 'vCPU',
        format: fmt.load,
        icon: Activity,
        colorKey: 'danger',
        thresholds: { warn: 2, danger: 4 },
        description: 'Active sessions (DB Load)',
    },
];

const REFRESH_OPTIONS = [
    { label: '30s', value: 30000 },
    { label: '1m', value: 60000 },
    { label: '5m', value: 300000 },
    { label: '15m', value: 900000 },
    { label: 'Off', value: 0 },
];

const RANGE_OPTIONS = [
    { label: '1h', value: 3600 },
    { label: '6h', value: 21600 },
    { label: '24h', value: 86400 },
    { label: '7d', value: 604800 },
];

const AWS_REGIONS = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-south-1',
    'eu-west-1',
    'eu-west-2',
    'eu-central-1',
    'sa-east-1',
    'ca-central-1',
];

const API_BASE = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'fathom_cw_instances';
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('fathom_token')}` });

const CW_STYLES = `
    @keyframes cwShimmer { 0% { background-position: -300% 0; } 100% { background-position: 300% 0; } }
    @keyframes cwSpin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes cwFadeUp  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes cwSlideIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: none; } }
    .cw-card {
        background: linear-gradient(180deg, #081633 0%, #081633f8 100%);
        border: 1px solid rgba(139,92,246,0.2);
        border-radius: 20px;
        padding: 24px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
        transition: all 0.25s ease;
        backdrop-filter: blur(12px);
    }
    .cw-card:hover {
        box-shadow: 0 8px 28px rgba(0,0,0,0.12);
        transform: translateY(-4px);
    }
    .cw-card::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--tile-accent, #3b82f6);
        opacity: 0.7;
    }
`;

/* ── sessionStorage helpers ── */
/* SECURITY WARNING: AWS credentials (accessKeyId, secretAccessKey) are stored in sessionStorage
 * instead of localStorage to prevent credentials from persisting across browser sessions.
 * sessionStorage is cleared when the browser tab closes, reducing the window of exposure.
 * Users should never store long-term credentials in the browser; use temporary credentials
 * from STS AssumeRole or IAM Identity Center (Cognito) for production systems. */
function loadInstances() {
    try {
        const r = sessionStorage.getItem(STORAGE_KEY);
        return r ? JSON.parse(r) : [];
    } catch {
        return [];
    }
}
function saveInstances(list) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
}

/* ── Tooltip ── */
const CWTooltip = ({ active, payload, label, unit, T }) => {
    if (!active || !payload?.length) return null;
    return (
        <div
            style={{
                background: T.glassHeavy,
                border: `1px solid ${T.glassBorder}`,
                borderRadius: 18,
                padding: '14px 20px',
                fontSize: 12,
                color: T.textMain,
                fontFamily: T.fontBody,
            }}
        >
            <div style={{ color: T.textMuted, marginBottom: 4 }}>{label}</div>
            <div style={{ color: T.primary, fontWeight: 600 }}>
                {payload[0]?.value?.toFixed(3)} {unit}
            </div>
        </div>
    );
};

/* ── Connect Instance Modal ── */
const ConnectModal = ({ T, onAdd, onClose, existing }) => {
    const [form, setForm] = useState({ accessKey: '', secretKey: '', region: 'ap-southeast-1', dbId: '' });
    const [showSecret, setShowSecret] = useState(false);
    const [errors, setErrors] = useState({});

    const set = (k, v) => {
        setForm((p) => ({ ...p, [k]: v }));
        setErrors((p) => ({ ...p, [k]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.accessKey.trim()) e.accessKey = 'Required';
        if (!form.secretKey.trim()) e.secretKey = 'Required';
        if (!form.region) e.region = 'Required';
        if (!form.dbId.trim()) e.dbId = 'Required';
        if (existing.some((i) => i.dbId === form.dbId.trim())) e.dbId = 'Already connected';
        return e;
    };

    const submit = () => {
        const e = validate();
        if (Object.keys(e).length) {
            setErrors(e);
            return;
        }
        // SEC-003: Validate AWS credential format and warn about security
        if (!/^AK[A-Z0-9]{18,}$/.test(form.accessKey.trim())) {
            setErrors({ accessKey: 'Invalid AWS Access Key format (should start with AK)' });
            return;
        }
        onAdd({
            id: form.dbId.trim(),
            dbId: form.dbId.trim(),
            accessKey: form.accessKey.trim(),
            secretKey: form.secretKey.trim(),
            region: form.region,
        });
        onClose();
    };

    const inputStyle = (k) => ({
        width: '100%',
        padding: '22px 28px',
        fontSize: 13,
        background: T.bg,
        border: `1px solid ${errors[k] ? T.danger + '60' : T.glassBorder}`,
        borderRadius: 18,
        color: T.textMain,
        outline: 'none',
        fontFamily: T.fontMono,
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    });

    const SectionDivider = ({ label }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ height: 1, flex: 1, background: T.glassBorder, minWidth: 0 }} />
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: T.textDim,
                    letterSpacing: '0.02em',

                    fontFamily: T.fontMono,
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </span>
            <div style={{ height: 1, flex: 1, background: T.glassBorder, minWidth: 0 }} />
        </div>
    );

    const FieldLabel = ({ label, required }) => (
        <label
            style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.textMuted,
                fontFamily: T.fontBody,
                display: 'block',
                marginBottom: 7,
            }}
        >
            {label} {required && <span style={{ color: T.danger }}>*</span>}
        </label>
    );

    const FieldHint = ({ k, hint }) => (
        <>
            {errors[k] && (
                <div style={{ fontSize: 11, color: T.danger, marginTop: 5, fontFamily: T.fontBody }}>⚠ {errors[k]}</div>
            )}
            {!errors[k] && hint && (
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 5, fontFamily: T.fontBody }}>{hint}</div>
            )}
        </>
    );

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: T.surface,
                    border: `1px solid ${T.glassBorder}`,
                    borderRadius: 20,
                    width: 500,
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    animation: 'cwSlideIn 0.22s ease-out',
                    boxShadow: `0 40px 100px rgba(0,0,0,0.5)`,
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '22px 26px 18px',
                        borderBottom: `1px solid ${T.glassBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'sticky',
                        top: 0,
                        background: T.surface,
                        zIndex: 1,
                        borderRadius: '20px 20px 0 0',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 16,
                                background: `${T.primary}15`,
                                border: `1px solid ${T.primary}30`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Cloud size={17} color={T.primary} />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.textMain, fontFamily: T.fontBody }}>
                                Connect RDS Instance
                            </div>
                            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.fontBody, marginTop: 2 }}>
                                Enter your AWS credentials and DB identifier
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: T.textDim,
                            cursor: 'pointer',
                            padding: 4,
                            display: 'flex',
                            borderRadius: 18,
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <SectionDivider label="AWS Credentials" />

                    {/* Access Key */}
                    <div>
                        <FieldLabel label="Access Key ID" required />
                        <input
                            autoFocus
                            value={form.accessKey}
                            onChange={(e) => set('accessKey', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submit()}
                            placeholder="AKIAxxxxxxxxxxxxxxxx"
                            style={inputStyle('accessKey')}
                        />
                        <FieldHint k="accessKey" hint="From IAM → Security credentials" />
                    </div>

                    {/* Secret Key */}
                    <div>
                        <FieldLabel label="Secret Access Key" required />
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={form.secretKey}
                                onChange={(e) => set('secretKey', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submit()}
                                placeholder="••••••••••••••••••••••••••••••••••••••••"
                                style={{ ...inputStyle('secretKey'), paddingRight: 44 }}
                            />
                            <button
                                onClick={() => setShowSecret((p) => !p)}
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: T.textDim,
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                }}
                            >
                                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                        <FieldHint k="secretKey" hint="Your AWS secret access key" />
                    </div>

                    {/* Region */}
                    <div>
                        <FieldLabel label="AWS Region" required />
                        <select
                            value={form.region}
                            onChange={(e) => set('region', e.target.value)}
                            style={{
                                ...inputStyle('region'),
                                fontFamily: T.fontBody,
                                cursor: 'pointer',
                                appearance: 'none',
                            }}
                        >
                            {AWS_REGIONS.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                        <FieldHint k="region" hint="Region where your RDS instance is hosted" />
                    </div>

                    <SectionDivider label="RDS Instance" />

                    {/* DB Identifier */}
                    <div>
                        <FieldLabel label="DB Instance Identifier" required />
                        <input
                            value={form.dbId}
                            onChange={(e) => set('dbId', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submit()}
                            placeholder="e.g. my-prod-postgres-db"
                            style={inputStyle('dbId')}
                        />
                        <FieldHint k="dbId" hint="Exact identifier from AWS RDS console" />
                    </div>

                    {/* Security note */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 22,
                            padding: '22px 28px',
                            borderRadius: 16,
                            background: `${T.warning}08`,
                            border: `1px solid ${T.warning}20`,
                        }}
                    >
                        <Shield size={14} color={T.warning} style={{ marginTop: 1, flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.65, fontFamily: T.fontBody }}>
                            Credentials are stored in your browser's localStorage and sent only to your own backend. Use
                            an IAM user with{' '}
                            <code style={{ color: T.warning, fontFamily: T.fontMono, fontSize: 11 }}>
                                cloudwatch:GetMetricStatistics
                            </code>{' '}
                            read-only permission.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 26px 22px',
                        display: 'flex',
                        gap: 22,
                        justifyContent: 'flex-end',
                        borderTop: `1px solid ${T.glassBorder}`,
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 18px',
                            fontSize: 13,
                            fontWeight: 500,
                            background: 'transparent',
                            border: `1px solid ${T.glassBorder}`,
                            borderRadius: 18,
                            color: T.textMuted,
                            cursor: 'pointer',
                            fontFamily: T.fontBody,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        style={{
                            padding: '9px 22px',
                            fontSize: 13,
                            fontWeight: 600,
                            background: `${T.primary}15`,
                            border: `1px solid ${T.primary}35`,
                            borderRadius: 18,
                            color: T.primary,
                            cursor: 'pointer',
                            fontFamily: T.fontBody,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                        }}
                    >
                        <ChevronRight size={14} />
                        Connect Instance
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Empty State ── */
const EmptyState = ({ T, onAdd }) => (
    <div style={{ padding: '60px 32px', textAlign: 'center', animation: 'cwFadeUp 0.5s ease-out' }}>
        <div
            style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                margin: '0 auto 24px',
                background: `radial-gradient(circle, ${T.primary}20, ${T.primary}05)`,
                border: `1px solid ${T.primary}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Cloud size={36} color={T.primary} />
        </div>
        <h2 style={{ fontFamily: T.fontBody, fontSize: 22, fontWeight: 700, color: T.textMain, marginBottom: 10 }}>
            No Instances Connected
        </h2>
        <p
            style={{
                color: T.textMuted,
                fontSize: 14,
                maxWidth: 440,
                margin: '0 auto 32px',
                lineHeight: 1.7,
                fontFamily: T.fontBody,
            }}
        >
            Enter your AWS credentials and RDS instance identifier directly — no environment variables or server
            restarts needed. Everything is saved in your browser.
        </p>
        <button
            onClick={onAdd}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 20,
                padding: '11px 24px',
                fontSize: 14,
                fontWeight: 600,
                background: `${T.primary}15`,
                border: `1px solid ${T.primary}35`,
                borderRadius: 16,
                color: T.primary,
                cursor: 'pointer',
                fontFamily: T.fontBody,
            }}
        >
            <Plus size={16} />
            Connect RDS Instance
        </button>
        <div
            style={{
                marginTop: 48,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
                maxWidth: 700,
                margin: '48px auto 0',
            }}
        >
            {[
                {
                    icon: Plus,
                    title: 'Per-instance credentials',
                    desc: 'Each instance has its own AWS credentials — monitor across multiple accounts.',
                },
                {
                    icon: Activity,
                    title: '9 live metrics',
                    desc: 'CPU, memory, IOPS, latency, connections and more, all in one view.',
                },
                {
                    icon: Shield,
                    title: 'Session-based storage',
                    desc: 'Credentials stored in sessionStorage for this browser session only. Automatically cleared when you close the tab.',
                },
            ].map(({ icon: Icon, title, desc }) => (
                <div
                    key={title}
                    style={{
                        padding: '18px 16px',
                        borderRadius: 18,
                        background: T.glass,
                        border: `1px solid ${T.glassBorder}`,
                        textAlign: 'left',
                    }}
                >
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 18,
                            background: `${T.primary}12`,
                            border: `1px solid ${T.primary}25`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                        }}
                    >
                        <Icon size={13} color={T.primary} />
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: T.textMain,
                            marginBottom: 6,
                            fontFamily: T.fontBody,
                        }}
                    >
                        {title}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.6, fontFamily: T.fontBody }}>
                        {desc}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

/* ── Metric Card ── */
const MetricCard = ({ def, datapoints, metricsLoading, T }) => {
    const current = datapoints?.length ? datapoints[datapoints.length - 1]?.value : null;
    const chartData = (datapoints || []).map((d) => ({ t: fmt.time(d.timestamp), v: d.value }));
    const color = T[def.colorKey] ?? T.primary;

    const valueColor = (() => {
        if (!def.thresholds || current === null || def.invertColor) return color;
        if (current >= def.thresholds.danger) return T.danger;
        if (current >= def.thresholds.warn) return T.warning;
        return T.success;
    })();

    const isLoading = metricsLoading && !datapoints;

    return (
        <div
            style={{
                background: T.glass,
                border: `1px solid ${T.glassBorder}`,
                borderTop: `2px solid ${color}40`,
                borderRadius: 20,
                padding: '18px 20px',
                transition: 'all 0.3s ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 18,
                        background: `${color}15`,
                        border: `1px solid ${color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <def.icon size={14} color={color} />
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: T.textDim,
                            letterSpacing: '0.02em',

                            fontFamily: T.fontBody,
                        }}
                    >
                        {def.label}
                    </div>
                    <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.fontBody }}>{def.description}</div>
                </div>
            </div>

            {isLoading ? (
                <div
                    style={{
                        height: 36,
                        borderRadius: 18,
                        marginBottom: 14,
                        background: `linear-gradient(90deg, ${T.surface} 20%, ${T.surfaceHover} 50%, ${T.surface} 80%)`,
                        backgroundSize: '300% 100%',
                        animation: 'cwShimmer 2s infinite',
                    }}
                />
            ) : (
                <div
                    style={{
                        fontFamily: T.fontBody,
                        fontWeight: 700,
                        fontSize: 26,
                        color: valueColor,
                        marginBottom: 14,
                        lineHeight: 1,
                    }}
                >
                    {current !== null ? (
                        def.format(current)
                    ) : (
                        <span style={{ color: T.textDim, fontSize: 16, fontWeight: 400 }}>No data</span>
                    )}
                </div>
            )}

            {isLoading ? (
                <div
                    style={{
                        height: 60,
                        borderRadius: 18,
                        background: `linear-gradient(90deg, ${T.surface} 20%, ${T.surfaceHover} 50%, ${T.surface} 80%)`,
                        backgroundSize: '300% 100%',
                        animation: 'cwShimmer 2.5s infinite',
                    }}
                />
            ) : chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.glassBorder} vertical={false} />
                        <XAxis dataKey="t" hide />
                        <YAxis hide />
                        <Tooltip content={<CWTooltip unit={def.unit} T={T} />} />
                        <Line
                            type="monotone"
                            dataKey="v"
                            stroke={color}
                            strokeWidth={1.5}
                            dot={false}
                            activeDot={{ r: 3, fill: color }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.fontBody }}>Insufficient data</span>
                </div>
            )}
        </div>
    );
};

/* ── Instance Dashboard ── */
const InstanceDashboard = ({ instance, timeRange, refreshInterval, T }) => {
    const [metrics, setMetrics] = useState({});
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const timerRef = useRef(null);

    const fetchMetrics = useCallback(async () => {
        setMetricsLoading(true);
        setFetchError(null);
        try {
            const results = await Promise.allSettled(
                METRIC_DEFS.map(async (def) => {
                    // ── FIX: period = granularity in seconds (not the total window) ──
                    // startTime/endTime define the window; period defines bucket size
                    const period = timeRange <= 3600 ? 60 : timeRange <= 86400 ? 300 : 3600;
                    const endTime = new Date();
                    const startTime = new Date(endTime.getTime() - timeRange * 1000);

                    const params = new URLSearchParams({
                        metric: def.key,
                        period: String(period),
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        db: instance.dbId,
                        accessKey: instance.accessKey,
                        secretKey: instance.secretKey,
                        region: instance.region,
                    });

                    const res = await fetch(`${API_BASE}/api/cloudwatch/metrics?${params}`, { headers: authHeader() });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || `HTTP ${res.status}`);
                    }
                    const d = await res.json();
                    return [def.key, d.datapoints || []];
                }),
            );

            const allFailed = results.every((r) => r.status === 'rejected');
            if (allFailed) {
                setFetchError(results[0].reason?.message || 'Failed to fetch metrics');
                setMetrics({});
            } else {
                const map = {};
                results.forEach((r) => {
                    if (r.status === 'fulfilled') map[r.value[0]] = r.value[1];
                });
                setMetrics(map);
                setLastRefresh(new Date());
            }
        } catch (e) {
            setFetchError(e.message);
        } finally {
            setMetricsLoading(false);
        }
    }, [instance, timeRange]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    useEffect(() => {
        clearInterval(timerRef.current);
        if (refreshInterval > 0) timerRef.current = setInterval(fetchMetrics, refreshInterval);
        return () => clearInterval(timerRef.current);
    }, [refreshInterval, fetchMetrics]);

    if (fetchError) {
        return (
            <div
                style={{
                    padding: '40px 32px',
                    borderRadius: 20,
                    background: `${T.danger}08`,
                    border: `1px solid ${T.danger}20`,
                    textAlign: 'center',
                }}
            >
                <AlertTriangle size={28} color={T.danger} style={{ marginBottom: 12 }} />
                <div
                    style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: T.textMain,
                        marginBottom: 8,
                        fontFamily: T.fontBody,
                    }}
                >
                    Failed to load metrics
                </div>
                <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 8, fontFamily: T.fontMono }}>
                    {fetchError}
                </div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20, fontFamily: T.fontBody }}>
                    Check your AWS credentials and that{' '}
                    <code style={{ color: T.primary, fontFamily: T.fontMono }}>{instance.dbId}</code> exists in{' '}
                    <code style={{ color: T.secondary, fontFamily: T.fontMono }}>{instance.region}</code>.
                </div>
                <button
                    onClick={fetchMetrics}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '8px 18px',
                        fontSize: 13,
                        fontWeight: 600,
                        background: `${T.primary}15`,
                        border: `1px solid ${T.primary}35`,
                        borderRadius: 18,
                        color: T.primary,
                        cursor: 'pointer',
                        fontFamily: T.fontBody,
                    }}
                >
                    <RefreshCw size={13} />
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            {/* Info bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 22px',
                    borderRadius: 16,
                    marginBottom: 20,
                    background: `${T.success}08`,
                    border: `1px solid ${T.success}25`,
                    flexWrap: 'wrap',
                    gap: 20,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <CheckCircle size={14} color={T.success} />
                    <span style={{ fontSize: 13, color: T.success, fontFamily: T.fontBody }}>Connected</span>
                    <span
                        style={{
                            padding: '2px 8px',
                            borderRadius: 9999,
                            background: `${T.primary}12`,
                            border: `1px solid ${T.primary}25`,
                            color: T.primary,
                            fontSize: 11,
                            fontFamily: T.fontMono,
                        }}
                    >
                        {instance.dbId}
                    </span>
                    <span
                        style={{
                            padding: '2px 8px',
                            borderRadius: 9999,
                            background: `${T.secondary}12`,
                            border: `1px solid ${T.secondary}25`,
                            color: T.secondary,
                            fontSize: 11,
                            fontFamily: T.fontMono,
                        }}
                    >
                        {instance.region}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    {lastRefresh && (
                        <span style={{ color: T.textDim, fontSize: 11, fontFamily: T.fontMono }}>
                            Updated {lastRefresh.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={fetchMetrics}
                        disabled={metricsLoading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 12px',
                            background: `${T.primary}15`,
                            border: `1px solid ${T.primary}35`,
                            borderRadius: 18,
                            color: T.primary,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: metricsLoading ? 'not-allowed' : 'pointer',
                            opacity: metricsLoading ? 0.6 : 1,
                            fontFamily: T.fontBody,
                        }}
                    >
                        <RefreshCw
                            size={12}
                            style={{ animation: metricsLoading ? 'cwSpin 1s linear infinite' : 'none' }}
                        />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
                {METRIC_DEFS.map((def) => (
                    <MetricCard
                        key={def.key}
                        def={def}
                        datapoints={metrics[def.key]}
                        metricsLoading={metricsLoading}
                        T={T}
                    />
                ))}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function CloudWatchTab() {
    const { isDark } = useTheme();
    const T = buildTheme(isDark);

    const [instances, setInstances] = useState(() => loadInstances());
    const [activeTab, setActiveTab] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(300000);
    const [customInterval, setCustomInterval] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [timeRange, setTimeRange] = useState(3600);

    useEffect(() => {
        saveInstances(instances);
    }, [instances]);

    useEffect(() => {
        if (instances.length > 0 && activeTab >= instances.length) setActiveTab(instances.length - 1);
    }, [instances, activeTab]);

    const addInstance = (inst) => {
        setInstances((prev) => {
            const next = [...prev, inst];
            setActiveTab(next.length - 1);
            return next;
        });
    };

    const removeInstance = (idx) => {
        setInstances((prev) => prev.filter((_, i) => i !== idx));
        setActiveTab((prev) => Math.max(0, prev >= idx ? prev - 1 : prev));
    };

    const styles = <style>{CW_STYLES}</style>;

    return (
        <div style={{ padding: '20px 24px', minHeight: '100%', fontFamily: T.fontBody }}>
            {styles}

            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 20,
                    flexWrap: 'wrap',
                    gap: 18,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 16,
                            background: `${T.primary}15`,
                            border: `1px solid ${T.primary}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Cloud size={18} color={T.primary} />
                    </div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: T.textMain }}>CloudWatch Metrics</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: T.fontBody }}>
                            {instances.length === 0
                                ? 'No instances connected'
                                : `${instances.length} instance${instances.length !== 1 ? 's' : ''} monitored`}
                        </div>
                    </div>
                </div>

                {instances.length > 0 && (
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Time Range */}
                        <div
                            style={{
                                display: 'flex',
                                background: T.surface,
                                borderRadius: 18,
                                overflow: 'hidden',
                                border: `1px solid ${T.glassBorder}`,
                            }}
                        >
                            {RANGE_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    onClick={() => setTimeRange(o.value)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: 'none',
                                        borderRight: `1px solid ${T.glassBorder}`,
                                        background: timeRange === o.value ? `${T.primary}20` : 'transparent',
                                        color: timeRange === o.value ? T.primary : T.textMuted,
                                        fontFamily: T.fontMono,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>

                        {/* Refresh Interval */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                                style={{
                                    display: 'flex',
                                    background: T.surface,
                                    borderRadius: 18,
                                    overflow: 'hidden',
                                    border: `1px solid ${T.glassBorder}`,
                                }}
                            >
                                {REFRESH_OPTIONS.map((o) => (
                                    <button
                                        key={o.value}
                                        onClick={() => {
                                            setRefreshInterval(o.value);
                                            setShowCustomInput(false);
                                        }}
                                        style={{
                                            padding: '6px 10px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderRight: `1px solid ${T.glassBorder}`,
                                            background:
                                                refreshInterval === o.value && !showCustomInput
                                                    ? `${T.secondary}20`
                                                    : 'transparent',
                                            color:
                                                refreshInterval === o.value && !showCustomInput
                                                    ? T.secondary
                                                    : T.textMuted,
                                            fontFamily: T.fontMono,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {o.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setShowCustomInput((p) => !p)}
                                    style={{
                                        padding: '6px 10px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: showCustomInput ? `${T.primary}20` : 'transparent',
                                        color: showCustomInput ? T.primary : T.textMuted,
                                        fontFamily: T.fontBody,
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    Custom
                                </button>
                            </div>
                            {showCustomInput && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <input
                                        type="number"
                                        value={customInterval}
                                        onChange={(e) => setCustomInterval(e.target.value)}
                                        placeholder="sec"
                                        min="10"
                                        style={{
                                            width: 72,
                                            padding: '5px 8px',
                                            fontSize: 12,
                                            background: T.surface,
                                            border: `1px solid ${T.glassBorder}`,
                                            borderRadius: 18,
                                            color: T.textMain,
                                            outline: 'none',
                                            fontFamily: T.fontMono,
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            const s = parseInt(customInterval, 10);
                                            if (!isNaN(s) && s >= 10) {
                                                setRefreshInterval(s * 1000);
                                                setShowCustomInput(false);
                                                setCustomInterval('');
                                            }
                                        }}
                                        style={{
                                            padding: '5px 10px',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            background: `${T.primary}15`,
                                            border: `1px solid ${T.primary}35`,
                                            borderRadius: 18,
                                            color: T.primary,
                                            cursor: 'pointer',
                                            fontFamily: T.fontBody,
                                        }}
                                    >
                                        Set
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 14px',
                                background: `${T.secondary}15`,
                                border: `1px solid ${T.secondary}35`,
                                borderRadius: 18,
                                color: T.secondary,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: T.fontBody,
                            }}
                        >
                            <Plus size={13} />
                            Add Instance
                        </button>
                    </div>
                )}
            </div>

            {instances.length === 0 ? (
                <EmptyState T={T} onAdd={() => setShowModal(true)} />
            ) : (
                <>
                    {/* Tabs */}
                    <div
                        style={{
                            display: 'flex',
                            marginBottom: 20,
                            borderBottom: `1px solid ${T.glassBorder}`,
                            overflowX: 'auto',
                        }}
                    >
                        {instances.map((inst, idx) => {
                            const isActive = activeTab === idx;
                            return (
                                <div
                                    key={inst.id + idx}
                                    style={{ display: 'flex', alignItems: 'center', marginBottom: -1, flexShrink: 0 }}
                                >
                                    <button
                                        onClick={() => setActiveTab(idx)}
                                        style={{
                                            padding: '10px 14px 10px 18px',
                                            fontSize: 13,
                                            fontWeight: isActive ? 600 : 400,
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
                                            background: 'transparent',
                                            color: isActive ? T.primary : T.textMuted,
                                            fontFamily: T.fontBody,
                                            transition: 'all 0.15s',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <span
                                                style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: '50%',
                                                    background: isActive ? T.primary : T.textDim,
                                                    display: 'inline-block',
                                                }}
                                            />
                                            {inst.id}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => removeInstance(idx)}
                                        title="Remove"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            marginRight: 6,
                                            background: 'transparent',
                                            border: 'none',
                                            color: T.textDim,
                                            cursor: 'pointer',
                                            padding: 0,
                                            transition: 'all 0.15s',
                                            flexShrink: 0,
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = `${T.danger}20`;
                                            e.currentTarget.style.color = T.danger;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = T.textDim;
                                        }}
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            );
                        })}
                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '22px 28px',
                                fontSize: 12,
                                border: 'none',
                                borderBottom: '2px solid transparent',
                                background: 'transparent',
                                color: T.textDim,
                                cursor: 'pointer',
                                fontFamily: T.fontBody,
                                transition: 'color 0.15s',
                                marginBottom: -1,
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = T.secondary)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = T.textDim)}
                        >
                            <Plus size={13} /> Add
                        </button>
                    </div>

                    {instances[activeTab] && (
                        <InstanceDashboard
                            key={instances[activeTab].id}
                            instance={instances[activeTab]}
                            timeRange={timeRange}
                            refreshInterval={refreshInterval}
                            T={T}
                        />
                    )}

                    <div
                        style={{
                            marginTop: 20,
                            padding: '18px 22px',
                            borderRadius: 16,
                            background: `${T.info}08`,
                            border: `1px solid ${T.info}20`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 22,
                        }}
                    >
                        <Info size={13} color={T.info} />
                        <span style={{ fontSize: 12, color: T.textDim, fontFamily: T.fontBody }}>
                            CloudWatch metrics have a 1-minute minimum resolution. Data may be delayed up to 5 minutes.
                            Standard CloudWatch charges apply.
                        </span>
                    </div>
                </>
            )}

            {showModal && (
                <ConnectModal T={T} onAdd={addInstance} onClose={() => setShowModal(false)} existing={instances} />
            )}
        </div>
    );
}
