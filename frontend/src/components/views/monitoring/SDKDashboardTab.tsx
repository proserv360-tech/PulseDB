/**
 * SDKDashboardTab.tsx
 * FATHOM SDK Hub — register apps, ingest events, view metrics.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { THEME, useAdaptiveTheme, useGlobalRefresh } from '../../../utils/theme';
import {
    Activity, AlertTriangle, Clock, Shield, Plus, RefreshCw,
    Copy, Check, ArrowLeft, Loader2, AlertCircle, Trash2, X,
    Key, Eye, EyeOff, RotateCw, Zap, BarChart2, Terminal,
    Settings, ChevronRight, ExternalLink,
} from 'lucide-react';

/* ── Fetch helpers ─────────────────────────────────────────────────────── */
function getToken() {
    try { return localStorage.getItem('fathom_token'); } catch { return null; }
}
function authHeaders() {
    const t = getToken();
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}
async function sdkFetch(path: string) {
    const res = await fetch(path, { headers: authHeaders() });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.detail || `HTTP ${res.status}`); }
    return res.json();
}
async function sdkPost(path: string, body: any) {
    const res = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.detail || `HTTP ${res.status}`); }
    return res.json();
}
async function sdkPut(path: string, body: any) {
    const res = await fetch(path, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.detail || `HTTP ${res.status}`); }
    return res.json();
}
async function sdkDelete(path: string) {
    const res = await fetch(path, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || d.detail || `HTTP ${res.status}`); }
    return res.json();
}
async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/* ── Formatting helpers ────────────────────────────────────────────────── */
function platformLabel(t: string) {
    return ({ salesforce: 'Salesforce', mulesoft: 'MuleSoft', nodejs: 'Node.js', java: 'Java', python: 'Python', dotnet: '.NET', custom: 'Custom' } as any)[t] || t;
}
function envColor(e: string) {
    return e === 'production' ? THEME.danger : e === 'staging' ? THEME.warning : THEME.primary;
}
function relTime(iso: string) {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    return `${Math.floor(d / 3600000)}h ago`;
}
function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateFull(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function latencyColor(ms: number) {
    return ms > 500 ? THEME.danger : ms > 200 ? THEME.warning : THEME.success;
}
function genSparkline(base: number, variance = 0.3, len = 16) {
    return Array.from({ length: len }, (_, i) => Math.max(0, base * (1 + (Math.random() - 0.5) * variance * 2) * (0.8 + i * 0.013)));
}
function genHourly(base: number, variance = 0.4, errRate = 0.05) {
    return Array.from({ length: 24 }, (_, i) => {
        const v = Math.max(0, Math.round(base * (1 + (Math.random() - 0.5) * variance * 2) * (0.6 + i * 0.017)));
        return { hour: i, events: v, errors: Math.round(v * errRate * (0.5 + Math.random())), latency: Math.round(base * 0.012 * (0.7 + Math.random() * 0.6)) };
    });
}

/* ── Toast ─────────────────────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'info';
const ToastCtx = React.createContext<((msg: string, type?: ToastType, dur?: number) => void) | null>(null);
function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<{ id: string; msg: string; type: ToastType }[]>([]);
    const add = useCallback((msg: string, type: ToastType = 'info', dur = 3200) => {
        const id = Math.random().toString(36).substr(2, 8);
        setToasts(p => [...p, { id, msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), dur);
    }, []);
    return (
        <ToastCtx.Provider value={add}>
            {children}
            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10,
                        fontSize: 13, fontWeight: 600, pointerEvents: 'all', minWidth: 240, maxWidth: 340,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        animation: 'sdk-toastIn 0.3s cubic-bezier(.16,1,.3,1)',
                        background: t.type === 'success' ? `${THEME.success}15` : t.type === 'error' ? `${THEME.danger}15` : THEME.surface,
                        border: `1px solid ${t.type === 'success' ? `${THEME.success}40` : t.type === 'error' ? `${THEME.danger}40` : THEME.glassBorder}`,
                        color: t.type === 'success' ? THEME.success : t.type === 'error' ? THEME.danger : THEME.textMain,
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: t.type === 'success' ? THEME.success : t.type === 'error' ? THEME.danger : THEME.primary }} />
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{t.msg}</span>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}
const useToast = () => React.useContext(ToastCtx)!;

/* ── Sparkline ─────────────────────────────────────────────────────────── */
function Sparkline({ data, color, height = 32, width = 80 }: { data: number[]; color: string; height?: number; width?: number }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const pts = data.map((v, i) => { const x = (i / (data.length - 1)) * width, y = height - ((v - min) / range) * (height - 4) - 2; return `${x},${y}`; }).join(' ');
    const id = `spk${color.replace(/[^a-z0-9]/gi, '')}${Math.random().toString(36).substr(2, 4)}`;
    return (
        <div style={{ opacity: 0.7 }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
                <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />
                <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

/* ── BarChart ───────────────────────────────────────────────────────────── */
function BarChart({ data, field = 'events', color = THEME.primary, height = 110 }: { data: any[]; field?: string; color?: string; height?: number }) {
    const max = Math.max(...data.map(d => d[field]), 1);
    const labels = ['12a', '', '', '3a', '', '', '6a', '', '', '9a', '', '', '12p', '', '', '3p', '', '', '6p', '', '', '9p', '', ''];
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
                {data.map((d, i) => {
                    const h = Math.max(2, Math.round((d[field] / max) * height));
                    return (
                        <div key={i} title={`${labels[i] || ''}: ${d[field]}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 4, cursor: 'default' }}>
                            <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '3px 3px 0 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height }}>
                                <div style={{ height: h, borderRadius: '3px 3px 0 0', background: color, opacity: 0.75 + 0.25 * (d[field] / max), transition: 'height 0.5s cubic-bezier(.16,1,.3,1)' }} />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {[0, 3, 6, 9, 12, 15, 18, 21].map(i => (
                    <span key={i} style={{ fontSize: 9, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{labels[i]}</span>
                ))}
            </div>
        </div>
    );
}

/* ── UptimeRing ────────────────────────────────────────────────────────── */
function UptimeRing({ pct, size = 80 }: { pct: number; size?: number }) {
    const r = size / 2 - 6, circ = 2 * Math.PI * r, dash = circ * (pct / 100), gap = circ - dash;
    const col = pct >= 99 ? THEME.success : pct >= 95 ? THEME.warning : THEME.danger;
    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="5"
                    strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.16,1,.3,1)' }} />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: THEME.fontMono, color: col, lineHeight: 1 }}>{pct}%</div>
                <div style={{ fontSize: 8, color: THEME.textMuted, letterSpacing: '0.06em', marginTop: 1 }}>UPTIME</div>
            </div>
        </div>
    );
}

/* ── StatCard ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, Icon, accentColor, pct, spark }: {
    label: string; value: string | number; sub?: string;
    Icon: React.ComponentType<any>; accentColor: string; pct?: number; spark?: number[];
}) {
    return (
        <div style={{
            background: THEME.surface, border: `1px solid rgba(99,102,241,0.10)`, borderRadius: 12, padding: '20px 22px',
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent 0%,${THEME.primary}50 50%,transparent 100%)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: THEME.textMuted, textTransform: 'uppercase' }}>{label}</span>
                <div style={{ color: accentColor, opacity: 0.75 }}><Icon size={16} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 5, fontFamily: THEME.fontMono, color: THEME.textMain }}>{value}</div>
                    {sub && <div style={{ fontSize: 11, color: THEME.textMuted }}>{sub}</div>}
                </div>
                {spark && <Sparkline data={spark} color={accentColor} />}
            </div>
            {pct !== undefined && (
                <div style={{ height: 3, borderRadius: 99, background: THEME.glassBorder, overflow: 'hidden', marginTop: 14 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, pct)}%`, background: accentColor, transition: 'width 0.7s cubic-bezier(.16,1,.3,1)' }} />
                </div>
            )}
        </div>
    );
}

/* ── EnvTag ─────────────────────────────────────────────────────────────── */
function EnvTag({ env }: { env: string }) {
    const col = envColor(env);
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: THEME.radiusSm,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: `${col}18`, color: col, border: `1px solid ${col}35`,
        }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: col }} />
            {env}
        </span>
    );
}

/* ── StatusBadge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    const ok = status === 'success';
    const col = ok ? THEME.success : THEME.danger;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: THEME.radiusSm,
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
            background: `${col}15`, color: col, border: `1px solid ${col}30`,
        }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: col }} />
            {status}
        </span>
    );
}

/* ── Card wrapper ───────────────────────────────────────────────────────── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{ background: THEME.surface, border: `1px solid ${THEME.glassBorder}`, borderRadius: THEME.radiusMd, boxShadow: THEME.shadowSm, ...style }}>
            {children}
        </div>
    );
}

/* ── Btn ────────────────────────────────────────────────────────────────── */
function Btn({ children, onClick, primary = false, danger = false, disabled = false, style = {} }: {
    children: React.ReactNode; onClick?: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; style?: React.CSSProperties;
}) {
    return (
        <button onClick={onClick} disabled={disabled} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '7px 14px', borderRadius: THEME.radiusSm, border: '1px solid',
            fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1, transition: THEME.transitionFast, fontFamily: 'inherit',
            background: primary ? THEME.primaryDark : danger ? `${THEME.danger}12` : THEME.surfaceHover,
            color: primary ? '#fff' : danger ? THEME.danger : THEME.textMuted,
            borderColor: primary ? 'transparent' : danger ? `${THEME.danger}30` : THEME.glassBorder,
            boxShadow: primary ? `0 0 16px ${THEME.primaryDark}40` : undefined,
            ...style,
        }}>{children}</button>
    );
}

/* ── Register Modal ─────────────────────────────────────────────────────── */
function RegisterModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: (app: any) => void }) {
    const toast = useToast();
    const [form, setForm] = useState({ name: '', platform: 'nodejs', env: 'staging', webhookUrl: '' });
    const [key, setKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [err, setErr] = useState('');

    if (!open) return null;

    const submit = async () => {
        if (!form.name.trim()) { setErr('App name is required.'); return; }
        setErr(''); setLoading(true);
        try {
            const res = await sdkPost('/api/sdk/apps', { name: form.name, appType: form.platform, environment: form.env, webhookUrl: form.webhookUrl });
            setKey(res.key);
            onSuccess(res.record || res.app || res);
            toast('Application registered successfully', 'success');
        } catch (e: any) { setErr(e.message || 'Registration failed'); }
        finally { setLoading(false); }
    };

    const handleCopy = async () => {
        if (key && await copyToClipboard(key)) { setCopied(true); toast('SDK key copied to clipboard', 'success', 2500); setTimeout(() => setCopied(false), 2500); }
    };

    const reset = () => { setKey(null); setShowKey(false); setForm({ name: '', platform: 'nodejs', env: 'staging', webhookUrl: '' }); onClose(); };

    return (
        <div onClick={reset} style={{ position: 'fixed', inset: 0, background: THEME.glassHeavy, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
            <style>{`.sdk-modal-box{animation:sdk-fadeUp 0.22s cubic-bezier(.16,1,.3,1);}@keyframes sdk-fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}`}</style>
            <div onClick={e => e.stopPropagation()} className="sdk-modal-box" style={{
                background: THEME.surface, border: `1px solid ${THEME.glassBorderHover}`, borderRadius: THEME.radiusLg, padding: 28,
                maxWidth: 490, width: '100%', boxShadow: THEME.shadowXl, position: 'relative',
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${THEME.primary}80 40%,${THEME.primaryLight}80 60%,transparent)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 17, fontWeight: 800, color: THEME.textMain, margin: 0 }}>Register Application</h2>
                        <p style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 4, marginBottom: 0 }}>Generate a unique SDK key for your integration</p>
                    </div>
                    <Btn onClick={reset} style={{ width: 32, height: 32, padding: 0 }}><X size={16} /></Btn>
                </div>

                {key ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '10px 14px', background: `${THEME.success}12`, borderRadius: THEME.radiusSm, border: `1px solid ${THEME.success}30` }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.success }} />
                            <span style={{ fontSize: 12.5, color: THEME.success, fontWeight: 600 }}>Application registered successfully</span>
                        </div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7 }}>SDK Secret Key</div>
                        <div style={{ background: THEME.bg, border: '1px solid rgba(99,102,241,0.26)', borderRadius: 7, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <code style={{ flex: 1, fontSize: 11, color: THEME.primary, fontFamily: THEME.fontMono, letterSpacing: '0.04em', wordBreak: 'break-all', filter: showKey ? 'none' : 'blur(5px)', transition: 'filter 0.2s' }}>{key}</code>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <Btn onClick={() => setShowKey(s => !s)} style={{ width: 32, height: 32, padding: 0 }}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</Btn>
                                <Btn onClick={handleCopy} style={{ width: 32, height: 32, padding: 0 }}>{copied ? <Check size={14} /> : <Copy size={14} />}</Btn>
                            </div>
                        </div>
                        <p style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 22, lineHeight: 1.7, padding: '10px 12px', background: THEME.bg, borderRadius: 6, border: '1px solid rgba(99,102,241,0.10)' }}>
                            <span style={{ color: THEME.warning }}>⚠</span> Store this key securely — it will not be shown again.
                        </p>
                        <Btn primary style={{ width: '100%', padding: 11 }} onClick={reset}><Check size={14} /> Done</Btn>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <div>
                            <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Application Name</label>
                            <input className="sdk-input" placeholder="e.g. Production Sync" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                                style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none', boxSizing: 'border-box' }} />
                            {err && <div style={{ fontSize: 11, color: THEME.danger, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={12} />{err}</div>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Platform</label>
                                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none' }}>
                                    {['salesforce', 'nodejs', 'mulesoft', 'python', 'java', 'dotnet'].map(v => <option key={v} value={v}>{platformLabel(v)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Environment</label>
                                <select value={form.env} onChange={e => setForm(f => ({ ...f, env: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none' }}>
                                    {['development', 'staging', 'production'].map(v => <option key={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>
                                Webhook URL <span style={{ color: THEME.textMuted, fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                            </label>
                            <input type="url" placeholder="https://your-endpoint.com/hook" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
                                style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ height: 1, background: THEME.glassBorder }} />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <Btn style={{ flex: 1 }} onClick={reset}>Cancel</Btn>
                            <Btn primary style={{ flex: 2 }} onClick={submit} disabled={loading}>
                                {loading ? <><Loader2 size={14} style={{ animation: 'sdk-spin 0.9s linear infinite' }} />Generating…</> : <><Zap size={14} />Create App</>}
                            </Btn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── App Detail ─────────────────────────────────────────────────────────── */
function AppDetail({ app: initialApp, onBack, onDelete, onUpdate }: { app: any; onBack: () => void; onDelete: (id: string) => void; onUpdate: (id: string, patch: any) => void }) {
    const toast = useToast();
    const [dtab, setDtab] = useState<'overview' | 'analytics' | 'events' | 'credentials' | 'config'>('overview');
    const [app, setApp] = useState(initialApp);
    const [sdkKey, setSdkKey] = useState('sk_live_••••••••••••••••••••••••••••••••');
    const [showKey, setShowKey] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);
    const [rotLoading, setRotLoading] = useState(false);
    const [delConfirm, setDelConfirm] = useState(false);
    const [editForm, setEditForm] = useState({ name: initialApp.name || '', description: initialApp.description || '', webhookUrl: initialApp.webhookUrl || initialApp.webhook_url || '', env: initialApp.env || initialApp.environment || 'development', platform: initialApp.platform || initialApp.app_type || 'nodejs' });
    const [saveLoading, setSaveLoading] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [liveHourly, setLiveHourly] = useState<any[] | null>(null);

    // Pull real hourly timeline from the SDK stats endpoint; fall back to the
    // synthetic generator only until live data arrives (or if it's empty).
    useEffect(() => {
        let cancelled = false;
        sdkFetch(`/api/sdk/apps/${app.id}/stats?groupBy=hour`).then((d: any) => {
            const timeline = d?.timeline || d?.stats?.timeline || [];
            if (!cancelled && Array.isArray(timeline) && timeline.length) {
                const mapped = timeline.map((t: any, i: number) => ({
                    hour: i,
                    events: Number(t.count ?? t.events ?? 0),
                    errors: Number(t.error_count ?? t.errors ?? 0),
                    latency: Number(d?.avgDuration?.avg_duration_ms ?? d?.avg_duration_ms ?? 0),
                }));
                setLiveHourly(mapped);
            }
        }).catch(() => { /* keep mock fallback */ });
        return () => { cancelled = true; };
    }, [app.id]);

    const mockHourly = useMemo(() => genHourly(Math.max(10, (app.totalEvents24h || app.events || 100) / 24), 0.5, (app.errorCount || app.errors || 0) > 0 ? 0.05 : 0.001), [app.id]);
    const hourly = liveHourly && liveHourly.length ? liveHourly : mockHourly;
    const totalToday = hourly.reduce((s: number, d: any) => s + d.events, 0);
    const errToday = hourly.reduce((s: number, d: any) => s + d.errors, 0);
    const errPct = totalToday ? (errToday / totalToday * 100).toFixed(1) : '0.0';
    const latMs = app.avgLatency || app.latency || 0;
    const uptime = app.uptime ?? 99.5;

    useEffect(() => {
        if (dtab === 'events') {
            setEventsLoading(true);
            sdkFetch(`/api/sdk/apps/${app.id}/events?limit=20`).then(d => {
                setEvents(Array.isArray(d) ? d : d?.events || []);
            }).catch(() => setEvents([])).finally(() => setEventsLoading(false));
        }
    }, [dtab, app.id]);

    const handleCopyKey = async () => { if (await copyToClipboard(sdkKey)) { setCopiedKey(true); toast('SDK key copied', 'success', 2000); setTimeout(() => setCopiedKey(false), 2000); } };
    const handleRotate = async () => {
        setRotLoading(true);
        try {
            const res = await sdkPost(`/api/sdk/apps/${app.id}/regenerate-key`, {});
            setSdkKey(res.key || res.apiKey || 'sk_live_rotated');
            setShowKey(false);
            toast('SDK key rotated — store your new key', 'success', 4000);
        } catch (e: any) { toast(e.message || 'Failed to rotate key', 'error'); }
        finally { setRotLoading(false); }
    };
    const handleDelete = async () => {
        try { await sdkDelete(`/api/sdk/apps/${app.id}`); toast('Application deleted', 'info'); onDelete(app.id); }
        catch (e: any) { toast(e.message || 'Delete failed', 'error'); }
    };
    const handleSave = async () => {
        setSaveLoading(true);
        try {
            await sdkPut(`/api/sdk/apps/${app.id}`, { name: editForm.name, description: editForm.description, webhookUrl: editForm.webhookUrl, environment: editForm.env, appType: editForm.platform });
            setApp((s: any) => ({ ...s, name: editForm.name, description: editForm.description }));
            onUpdate(app.id, editForm);
            toast('Settings saved', 'success');
        } catch (e: any) { toast(e.message || 'Save failed', 'error'); }
        finally { setSaveLoading(false); }
    };

    const typeColor = (t: string) => ({ api_call: THEME.primary, webhook: THEME.success, sync: THEME.warning, auth: THEME.danger } as any)[t] || THEME.textMuted;

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'events', label: 'Events' },
        { id: 'credentials', label: 'Credentials' },
        { id: 'config', label: 'Config' },
    ] as const;

    return (
        <div style={{ animation: 'sdk-slideRight 0.32s cubic-bezier(.16,1,.3,1)' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: THEME.textMuted, marginBottom: 20 }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 0 }}><ArrowLeft size={14} /></button>
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: 0 }}>Overview</button>
                <ChevronRight size={12} />
                <span style={{ color: THEME.textMain, fontWeight: 600 }}>{app.name}</span>
            </div>

            {/* App header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(99,102,241,0.09)', border: '1px solid rgba(99,102,241,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: THEME.primary }}>
                        {(app.name || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                            <h1 style={{ fontSize: 22, fontWeight: 800, color: THEME.textMain, margin: 0 }}>{app.name}</h1>
                            <EnvTag env={app.environment || app.env || 'development'} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: THEME.textMuted }}>
                            <span>{platformLabel(app.app_type || app.platform || 'custom')}</span>
                            <span>·</span>
                            <span style={{ fontFamily: THEME.fontMono }}>ID: {app.id}</span>
                            {app.createdAt || app.created_at ? <><span>·</span><span>Created {fmtDateFull(app.createdAt || app.created_at)}</span></> : null}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {!delConfirm
                        ? <Btn danger onClick={() => setDelConfirm(true)}><Trash2 size={13} />Delete</Btn>
                        : <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11.5, color: THEME.danger, fontWeight: 600 }}>Confirm delete?</span>
                            <Btn danger onClick={handleDelete}>Yes, delete</Btn>
                            <Btn onClick={() => setDelConfirm(false)}>Cancel</Btn>
                        </div>}
                </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 2, padding: 4, background: THEME.bg, borderRadius: 12, border: '1px solid rgba(99,102,241,0.10)', width: 'fit-content', marginBottom: 24 }}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setDtab(t.id)}
                        style={{
                            padding: '7px 16px', borderRadius: 7, border: dtab === t.id ? '1px solid rgba(99,102,241,0.26)' : '1px solid transparent',
                            background: dtab === t.id ? THEME.surface : 'transparent', color: dtab === t.id ? THEME.textMain : THEME.textMuted,
                            cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s',
                        }}>{t.label}</button>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {dtab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13 }}>
                        <StatCard label="Events / 24h" value={totalToday.toLocaleString()} sub="processed today" Icon={Zap} accentColor={THEME.success} spark={genSparkline(totalToday / 16, 0.4)} pct={Math.min(100, totalToday / 200)} />
                        <StatCard label="Error Rate" value={`${errPct}%`} sub={`${errToday} failed`} Icon={Activity} accentColor={parseFloat(errPct) > 5 ? THEME.danger : THEME.success} spark={genSparkline(parseFloat(errPct) + 0.5, 0.5)} pct={parseFloat(errPct) * 10} />
                        <StatCard label="Avg Latency" value={`${latMs}ms`} sub="p50 response time" Icon={Clock} accentColor={latencyColor(latMs)} spark={genSparkline(latMs * 0.9, 0.3)} pct={Math.min(100, (latMs / 1000) * 100)} />
                        <div style={{ background: THEME.surface, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UptimeRing pct={uptime} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14 }}>
                        <Card style={{ padding: 20 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>About</div>
                            <p style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 1.7, marginBottom: 16 }}>{app.description || 'No description set.'}</p>
                            <div style={{ height: 1, background: THEME.glassBorder }} />
                            <div style={{ marginTop: 14 }}>
                                {[
                                    { k: 'Platform', v: platformLabel(app.app_type || app.platform || 'custom') },
                                    { k: 'Environment', v: <EnvTag env={app.environment || app.env || 'development'} /> },
                                    { k: 'Webhook', v: (app.webhookUrl || app.webhook_url) ? <code style={{ color: THEME.primary, fontSize: 11 }}>{app.webhookUrl || app.webhook_url}</code> : <span style={{ color: THEME.textMuted, fontSize: 12 }}>Not configured</span> },
                                    { k: 'Total Events', v: <span style={{ fontFamily: THEME.fontMono, fontSize: 13 }}>{(app.totalEvents24h || 0).toLocaleString()}</span> },
                                    { k: 'Total Errors', v: <span style={{ fontFamily: THEME.fontMono, fontSize: 13, color: (app.errorCount || 0) > 0 ? THEME.danger : THEME.success }}>{app.errorCount || 0}</span> },
                                ].map(r => (
                                    <div key={r.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(99,102,241,0.07)' }}>
                                        <span style={{ fontSize: 12, color: THEME.textMuted, fontWeight: 600 }}>{r.k}</span>
                                        <span style={{ fontSize: 12.5, color: THEME.textMain }}>{r.v as any}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase' }}>Recent Events</div>
                            {hourly.slice(-6).map((d: any, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: d.errors > 0 ? THEME.danger : THEME.success, flexShrink: 0 }} />
                                    <span style={{ color: THEME.primary, flex: 1, fontWeight: 600 }}>{d.events} events</span>
                                    <span style={{ fontFamily: THEME.fontMono, color: latencyColor(d.latency || 0), fontSize: 11 }}>{d.latency}ms</span>
                                    <span style={{ color: THEME.textMuted, fontSize: 10.5, fontFamily: THEME.fontMono }}>{23 - i}h ago</span>
                                </div>
                            ))}
                        </Card>
                    </div>
                </div>
            )}

            {/* ── ANALYTICS ── */}
            {dtab === 'analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Card style={{ padding: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                            <div>
                                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Hourly Throughput</div>
                                <div style={{ fontSize: 11.5, color: THEME.textMuted }}>Events processed over the past 24 hours</div>
                            </div>
                            <div style={{ fontFamily: THEME.fontMono, fontSize: 22, fontWeight: 800, color: THEME.primary }}>{totalToday.toLocaleString()}</div>
                        </div>
                        <BarChart data={hourly} field="events" color={THEME.primaryLight} height={110} />
                    </Card>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <Card style={{ padding: 22 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                <div>
                                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Errors / Hour</div>
                                    <div style={{ fontSize: 11.5, color: THEME.textMuted }}>Failed events in 24h window</div>
                                </div>
                                <div style={{ fontFamily: THEME.fontMono, fontSize: 22, fontWeight: 800, color: errToday > 0 ? THEME.danger : THEME.success }}>{errToday}</div>
                            </div>
                            <BarChart data={hourly} field="errors" color={THEME.dangerLight} height={80} />
                        </Card>
                        <Card style={{ padding: 22 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                <div>
                                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Latency (ms)</div>
                                    <div style={{ fontSize: 11.5, color: THEME.textMuted }}>Average response time per hour</div>
                                </div>
                                <div style={{ fontFamily: THEME.fontMono, fontSize: 22, fontWeight: 800, color: latencyColor(latMs) }}>{latMs}ms</div>
                            </div>
                            <BarChart data={hourly} field="latency" color={latencyColor(latMs)} height={80} />
                        </Card>
                    </div>
                    {errToday > 0 && (
                        <Card style={{ padding: 22 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 16 }}>Error Breakdown</div>
                            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                {[
                                    { label: 'Auth failures', count: Math.round(errToday * 0.35), color: THEME.danger },
                                    { label: 'Timeout', count: Math.round(errToday * 0.28), color: THEME.warning },
                                    { label: 'Schema mismatch', count: Math.round(errToday * 0.22), color: THEME.primary },
                                    { label: 'Rate limit', count: Math.round(errToday * 0.15), color: THEME.success },
                                ].map(e => (
                                    <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
                                        <div style={{ width: 3, height: 32, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                                        <div>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: e.color, fontFamily: THEME.fontMono }}>{e.count}</div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted }}>{e.label}</div>
                                        </div>
                                        <div style={{ marginLeft: 'auto' }}>
                                            <div style={{ height: 3, borderRadius: 99, background: THEME.glassBorder, overflow: 'hidden', width: 80 }}>
                                                <div style={{ height: '100%', borderRadius: 99, width: `${errToday ? Math.round(e.count / errToday * 100) : 0}%`, background: e.color }} />
                                            </div>
                                            <div style={{ fontSize: 9.5, color: THEME.textMuted, textAlign: 'right', marginTop: 3, fontFamily: THEME.fontMono }}>
                                                {errToday ? Math.round(e.count / errToday * 100) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ── EVENTS ── */}
            {dtab === 'events' && (
                <Card style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 72px 130px', alignItems: 'center', padding: '9px 20px', gap: 14, borderBottom: '1px solid rgba(99,102,241,0.10)', background: THEME.bg }}>
                        {['Event ID', 'Type', 'Status', 'Latency', 'Time'].map(h => (
                            <div key={h} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: THEME.textMuted, textTransform: 'uppercase' }}>{h}</div>
                        ))}
                    </div>
                    {eventsLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={24} color={THEME.primary} style={{ animation: 'sdk-spin 0.9s linear infinite' }} /></div>}
                    {!eventsLoading && events.length === 0 && <div style={{ padding: 52, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>No events for this application.</div>}
                    {!eventsLoading && events.map((e: any) => (
                        <div key={e.id || e.event_id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 72px 130px', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid rgba(99,102,241,0.05)', gap: 14 }}>
                            <code style={{ fontSize: 11, color: THEME.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: THEME.fontMono }}>{e.id || e.event_id}</code>
                            <div style={{ fontSize: 11, color: typeColor(e.type || e.event_type), textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{e.type || e.event_type}</div>
                            <StatusBadge status={e.status || (e.error ? 'error' : 'success')} />
                            <code style={{ fontFamily: THEME.fontMono, fontSize: 12.5, color: latencyColor(e.latency || 0) }}>{e.latency || 0}ms</code>
                            <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{e.timestamp ? relTime(e.timestamp) : '—'}</div>
                        </div>
                    ))}
                </Card>
            )}

            {/* ── CREDENTIALS ── */}
            {dtab === 'credentials' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Card style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(99,102,241,0.5) 40%,rgba(129,140,248,0.5) 60%,transparent)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                            <div>
                                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>SDK Secret Key</div>
                                <p style={{ fontSize: 12.5, color: THEME.textMuted, margin: 0 }}>Use this key to authenticate all SDK calls from this application.</p>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Btn onClick={() => setShowKey(s => !s)}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}{showKey ? 'Hide' : 'Reveal'}</Btn>
                                <Btn onClick={handleCopyKey}>{copiedKey ? <Check size={14} /> : <Copy size={14} />}Copy</Btn>
                            </div>
                        </div>
                        <div style={{ background: THEME.bg, border: '1px solid rgba(99,102,241,0.26)', borderRadius: 7, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                            <Key size={16} color={THEME.textMuted} style={{ flexShrink: 0 }} />
                            <code style={{ flex: 1, fontSize: 12, color: THEME.primary, fontFamily: THEME.fontMono, letterSpacing: '0.04em', filter: showKey ? 'none' : 'blur(6px)', transition: 'filter 0.25s', userSelect: showKey ? 'auto' : 'none', wordBreak: 'break-all' }}>{sdkKey}</code>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(251,191,36,0.08)', borderRadius: 8, border: '1px solid rgba(251,191,36,0.2)', marginBottom: 20 }}>
                            <AlertTriangle size={14} color={THEME.warning} />
                            <span style={{ fontSize: 12, color: THEME.warning, lineHeight: 1.5 }}>Rotating this key will immediately invalidate the current one. Update your integration before rotating.</span>
                        </div>
                        <Btn onClick={handleRotate} disabled={rotLoading}>
                            {rotLoading ? <><Loader2 size={14} style={{ animation: 'sdk-spin 0.9s linear infinite' }} />Rotating…</> : <><RotateCw size={14} />Rotate Key</>}
                        </Btn>
                    </Card>
                    <Card style={{ padding: 22 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Quick-start snippet</div>
                        <div style={{ background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, padding: '14px 16px', fontSize: 12, fontFamily: THEME.fontMono, color: THEME.textMuted, lineHeight: 1.7, overflowX: 'auto' }}>
                            <span style={{ color: THEME.primary }}>import</span> {`{Fathom}`} <span style={{ color: THEME.primary }}>from</span> <span style={{ color: THEME.success }}>'@fathom/sdk'</span><br /><br />
                            <span style={{ color: THEME.primary }}>const</span> sdk = <span style={{ color: THEME.primary }}>new</span> Fathom({'{'}<br />
                            &nbsp;&nbsp;appId: <span style={{ color: THEME.success }}>'{app.id}'</span>,<br />
                            &nbsp;&nbsp;key: <span style={{ color: THEME.success }}>'{showKey ? sdkKey : 'sk_live_••••••••••••••••••••••••••••••••'}'</span>,<br />
                            &nbsp;&nbsp;env: <span style={{ color: THEME.success }}>'{app.environment || app.env || 'development'}'</span><br />
                            {'}'})<br /><br />
                            sdk.track(<span style={{ color: THEME.success }}>'event_name'</span>, payload)<br />
                            <span style={{ color: THEME.textMuted, opacity: 0.5 }}>{'// SDK will auto-retry on failure'}</span>
                        </div>
                    </Card>
                </div>
            )}

            {/* ── CONFIG ── */}
            {dtab === 'config' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680 }}>
                    <Card style={{ padding: 22 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 16 }}>Application Details</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { label: 'Application Name', key: 'name', type: 'text', placeholder: '' },
                                { label: 'Webhook URL', key: 'webhookUrl', type: 'url', placeholder: 'https://your-endpoint.com/hook' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>{f.label}</label>
                                    <input type={f.type} value={(editForm as any)[f.key]} placeholder={f.placeholder}
                                        onChange={e => setEditForm(frm => ({ ...frm, [f.key]: e.target.value }))}
                                        style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            ))}
                            <div>
                                <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Description</label>
                                <textarea rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Platform</label>
                                    <select value={editForm.platform} onChange={e => setEditForm(f => ({ ...f, platform: e.target.value }))}
                                        style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none' }}>
                                        {['salesforce', 'nodejs', 'mulesoft', 'python', 'java', 'dotnet'].map(v => <option key={v} value={v}>{platformLabel(v)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Environment</label>
                                    <select value={editForm.env} onChange={e => setEditForm(f => ({ ...f, env: e.target.value }))}
                                        style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none' }}>
                                        {['development', 'staging', 'production'].map(v => <option key={v}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </Card>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <Btn primary onClick={handleSave} disabled={saveLoading}>
                            {saveLoading ? <><Loader2 size={14} style={{ animation: 'sdk-spin 0.9s linear infinite' }} />Saving…</> : <><Check size={14} />Save Changes</>}
                        </Btn>
                        <Btn onClick={() => setEditForm({ name: initialApp.name || '', description: initialApp.description || '', webhookUrl: initialApp.webhookUrl || initialApp.webhook_url || '', env: initialApp.environment || initialApp.env || 'development', platform: initialApp.app_type || initialApp.platform || 'nodejs' })}>Reset</Btn>
                    </div>
                    <Card style={{ padding: 22, border: '1px solid rgba(248,113,113,0.15)', background: 'rgba(248,113,113,0.03)' }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(248,113,113,0.5)', textTransform: 'uppercase', marginBottom: 8 }}>Danger Zone</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>Delete this application</div>
                                <div style={{ fontSize: 11.5, color: THEME.textMuted, marginTop: 3 }}>This will permanently remove the app and revoke its SDK key.</div>
                            </div>
                            {!delConfirm
                                ? <Btn danger onClick={() => setDelConfirm(true)}><Trash2 size={13} />Delete App</Btn>
                                : <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ fontSize: 11.5, color: THEME.danger, fontWeight: 600 }}>Are you sure?</span>
                                    <Btn danger onClick={handleDelete}>Yes, delete</Btn>
                                    <Btn onClick={() => setDelConfirm(false)}>Cancel</Btn>
                                </div>}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

/* ── Event Stream View ─────────────────────────────────────────────────── */
function EventStreamView({ apps }: { apps: any[] }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const allEvents: any[] = [];
            await Promise.all(apps.slice(0, 5).map(async a => {
                try {
                    const d = await sdkFetch(`/api/sdk/apps/${a.id}/events?limit=15`);
                    const evts = (Array.isArray(d) ? d : d?.events || []).map((e: any) => ({ ...e, appName: a.name, appId: a.id }));
                    allEvents.push(...evts);
                } catch { /* skip */ }
            }));
            allEvents.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            setEvents(allEvents);
        } catch { setEvents([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [apps.length]);

    const shown = filter === 'all' ? events : events.filter(e => (e.status || (e.error ? 'error' : 'success')) === filter);
    const sc = events.filter(e => (e.status || (e.error ? 'error' : 'success')) === 'success').length;
    const ec = events.filter(e => (e.status || (e.error ? 'error' : 'success')) === 'error').length;
    const tc = (t: string) => ({ api_call: THEME.primary, webhook: THEME.success, sync: THEME.warning, auth: THEME.danger } as any)[t] || THEME.textMuted;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Telemetry</div>
                    <h1 style={{ fontSize: 25, fontWeight: 800, color: THEME.textMain, margin: 0, letterSpacing: '-0.025em' }}>Event Stream</h1>
                    <p style={{ fontSize: 12.5, color: THEME.textMuted, marginTop: 6, marginBottom: 0 }}>Live view of <code style={{ fontSize: 11.5, background: THEME.surface, padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.10)', fontFamily: THEME.fontMono }}>sdk_events</code></p>
                </div>
                <Btn onClick={load}><RefreshCw size={14} />Refresh</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center' }}>
                {[{ id: 'all', label: 'All', count: events.length }, { id: 'success', label: 'Success', count: sc }, { id: 'error', label: 'Error', count: ec }].map(f => (
                    <Btn key={f.id} onClick={() => setFilter(f.id)} style={{ background: filter === f.id ? 'rgba(99,102,241,0.09)' : undefined, borderColor: filter === f.id ? THEME.glassBorderHover : undefined, color: filter === f.id ? THEME.textMain : undefined }}>
                        {f.label}
                        <span style={{ fontFamily: THEME.fontMono, fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: filter === f.id ? 'rgba(99,102,241,0.2)' : THEME.surface, color: filter === f.id ? THEME.primary : THEME.textMuted }}>{f.count}</span>
                    </Btn>
                ))}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 10.5, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{shown.length} shown</span>
            </div>
            <Card style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 72px 130px', padding: '9px 20px', gap: 14, borderBottom: '1px solid rgba(99,102,241,0.10)', background: THEME.bg }}>
                    {['Event ID', 'Application', 'Status', 'Latency', 'Time'].map(h => (
                        <div key={h} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: THEME.textMuted, textTransform: 'uppercase' }}>{h}</div>
                    ))}
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={24} color={THEME.primary} style={{ animation: 'sdk-spin 0.9s linear infinite' }} /></div>}
                    {!loading && shown.map((e: any) => {
                        const eid = e.id || e.event_id || Math.random().toString(36).substr(2, 8);
                        const status = e.status || (e.error ? 'error' : 'success');
                        return (
                            <React.Fragment key={eid}>
                                <div onClick={() => setExpanded(expanded === eid ? null : eid)}
                                    style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 72px 130px', alignItems: 'center', padding: '11px 20px', borderBottom: '1px solid rgba(99,102,241,0.05)', gap: 14, cursor: 'pointer', transition: 'background 0.1s' }}>
                                    <code style={{ fontSize: 11, color: THEME.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: THEME.fontMono }}>{eid}</code>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: THEME.textMain }}>{e.appName || 'Unknown'}</div>
                                        <div style={{ fontSize: 9.5, color: tc(e.type || e.event_type), textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 2 }}>{e.type || e.event_type || 'event'}</div>
                                    </div>
                                    <StatusBadge status={status} />
                                    <code style={{ fontFamily: THEME.fontMono, fontSize: 12.5, color: latencyColor(e.latency || 0) }}>{e.latency || 0}ms</code>
                                    <div style={{ fontSize: 11, color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                                        {e.timestamp ? <><div>{fmtDate(e.timestamp)}</div><div style={{ marginTop: 1 }}>{relTime(e.timestamp)}</div></> : '—'}
                                    </div>
                                </div>
                                {expanded === eid && (
                                    <div style={{ padding: '12px 20px 14px', background: THEME.bg, borderBottom: '1px solid rgba(99,102,241,0.10)' }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Payload</div>
                                        <div style={{ background: THEME.surface, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, padding: '14px 16px', fontSize: 11, fontFamily: THEME.fontMono, color: THEME.textMuted, lineHeight: 1.7, overflowX: 'auto' }}>
                                            {JSON.stringify(e.payload || e.metadata || e, null, 2)}
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                    {!loading && shown.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: THEME.textMuted, fontSize: 13 }}>No events match this filter.</div>}
                </div>
            </Card>
        </div>
    );
}

/* ── Logs View ─────────────────────────────────────────────────────────── */
function LogsView() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const load = async () => {
        setLoading(true);
        try {
            const d = await sdkFetch('/api/sdk/logs');
            setLogs(Array.isArray(d) ? d : d?.logs || []);
        } catch {
            setLogs([]);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const shown = filter === 'all' ? logs : logs.filter(l => l.level === filter);
    const counts: any = { all: logs.length, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
    logs.forEach(l => { if (counts[l.level] !== undefined) counts[l.level]++; });

    const lc = (l: string) => ({ DEBUG: THEME.textMuted, INFO: THEME.primary, WARN: THEME.warning, ERROR: THEME.danger } as any)[l] || THEME.textMuted;
    const lb = (l: string) => ({ DEBUG: 'rgba(62,68,120,0.12)', INFO: 'rgba(99,102,241,0.09)', WARN: 'rgba(251,191,36,0.08)', ERROR: 'rgba(248,113,113,0.08)' } as any)[l];
    const lbr = (l: string) => ({ DEBUG: 'rgba(62,68,120,0.2)', INFO: THEME.glassBorderHover, WARN: 'rgba(251,191,36,0.2)', ERROR: 'rgba(248,113,113,0.2)' } as any)[l];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Diagnostics</div>
                    <h1 style={{ fontSize: 25, fontWeight: 800, color: THEME.textMain, margin: 0, letterSpacing: '-0.025em' }}>System Logs</h1>
                    <p style={{ fontSize: 12.5, color: THEME.textMuted, marginTop: 6, marginBottom: 0 }}>Platform-level log output from all SDK modules</p>
                </div>
                <Btn onClick={load}><RefreshCw size={14} />Refresh</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                {['all', 'DEBUG', 'INFO', 'WARN', 'ERROR'].map(f => (
                    <Btn key={f} onClick={() => setFilter(f)} style={{
                        background: filter === f ? (f === 'all' ? 'rgba(99,102,241,0.09)' : lb(f)) : undefined,
                        borderColor: filter === f ? (f === 'all' ? THEME.glassBorderHover : lbr(f)) : undefined,
                        color: filter === f ? (f === 'all' ? THEME.textMain : lc(f)) : undefined,
                    }}>
                        {f === 'all' ? 'All' : f}
                        <span style={{ fontFamily: THEME.fontMono, fontSize: 10.5, padding: '1px 6px', borderRadius: 4, background: THEME.surface, color: THEME.textMuted }}>{counts[f] ?? 0}</span>
                    </Btn>
                ))}
            </div>
            <Card style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 70px 1fr', padding: '9px 20px', borderBottom: '1px solid rgba(99,102,241,0.10)', background: THEME.bg, gap: 14 }}>
                    {['Timestamp', 'Level', 'Message'].map(h => (<div key={h} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: THEME.textMuted, textTransform: 'uppercase' }}>{h}</div>))}
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={24} color={THEME.primary} style={{ animation: 'sdk-spin 0.9s linear infinite' }} /></div>}
                    {!loading && shown.map((l: any, i: number) => (
                        <div key={l.id || i} style={{ display: 'grid', gridTemplateColumns: '130px 70px 1fr', alignItems: 'flex-start', padding: '9px 20px', borderBottom: '1px solid rgba(99,102,241,0.05)', gap: 14 }}>
                            <div>
                                <div style={{ fontSize: 10.5, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{l.timestamp ? fmtTime(l.timestamp) : '—'}</div>
                                <div style={{ fontSize: 9.5, color: THEME.textMuted, marginTop: 2, fontFamily: THEME.fontMono }}>{l.timestamp ? fmtDate(l.timestamp) : ''}</div>
                            </div>
                            <div>
                                <span style={{ display: 'inline-flex', padding: '2px 7px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.09em', background: lb(l.level), color: lc(l.level), border: `1px solid ${lbr(l.level)}` }}>{l.level}</span>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, marginBottom: 3, fontWeight: 500, color: THEME.textMain }}>{l.message}</div>
                                <div style={{ fontSize: 10, color: THEME.textMuted, fontFamily: THEME.fontMono }}>{l.source}</div>
                            </div>
                        </div>
                    ))}
                    {!loading && shown.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: THEME.textMuted, fontSize: 13 }}>No logs at this level.</div>}
                </div>
            </Card>
        </div>
    );
}

/* ── Settings View ─────────────────────────────────────────────────────── */
function SettingsView() {
    const toast = useToast();
    const [prefs, setPrefs] = useState({ webhooks: true, rateLimiting: true, debugMode: false, autoRotateKeys: false, retryFailed: true, logLevel: 'INFO', apiEndpoint: '/api/sdk', region: 'us-east-1' });
    const set = (k: string) => (v: any) => setPrefs(p => ({ ...p, [k]: v }));

    function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
        return (
            <div onClick={() => onChange(!on)} style={{ position: 'relative', width: 38, height: 20, cursor: 'pointer' }}>
                <div style={{ width: 38, height: 20, borderRadius: 99, background: on ? THEME.primaryDark : THEME.glassBorder, border: '1px solid rgba(99,102,241,0.26)', transition: 'background 0.2s' }} />
                <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s cubic-bezier(.16,1,.3,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: 30 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Configuration</div>
                <h1 style={{ fontSize: 25, fontWeight: 800, color: THEME.textMain, margin: 0, letterSpacing: '-0.025em' }}>Settings</h1>
                <p style={{ fontSize: 12.5, color: THEME.textMuted, marginTop: 6, marginBottom: 0 }}>Platform-wide SDK configuration and preferences</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Integration</div>
                    <Card style={{ overflow: 'hidden' }}>
                        {[{ key: 'webhooks', label: 'Webhooks', desc: 'Enable outbound webhook delivery' }, { key: 'rateLimiting', label: 'Rate Limiting', desc: 'Enforce per-app API rate limits' }, { key: 'retryFailed', label: 'Retry on Failure', desc: 'Automatically retry failed events' }].map(r => (
                            <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(99,102,241,0.10)' }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>{r.label}</div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3 }}>{r.desc}</div>
                                </div>
                                <Toggle on={(prefs as any)[r.key]} onChange={set(r.key)} />
                            </div>
                        ))}
                    </Card>
                </div>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Developer</div>
                    <Card style={{ overflow: 'hidden' }}>
                        {[{ key: 'debugMode', label: 'Debug Mode', desc: 'Log verbose SDK internals' }, { key: 'autoRotateKeys', label: 'Auto-rotate Keys', desc: 'Rotate SDK keys every 90 days' }].map(r => (
                            <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(99,102,241,0.10)' }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>{r.label}</div>
                                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3 }}>{r.desc}</div>
                                </div>
                                <Toggle on={(prefs as any)[r.key]} onChange={set(r.key)} />
                            </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textMain }}>Log Level</div>
                                <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3 }}>Minimum log verbosity</div>
                            </div>
                            <select value={prefs.logLevel} onChange={e => set('logLevel')(e.target.value)} style={{ padding: '6px 10px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 12, fontFamily: THEME.fontMono, outline: 'none' }}>
                                {['DEBUG', 'INFO', 'WARN', 'ERROR'].map(l => <option key={l}>{l}</option>)}
                            </select>
                        </div>
                    </Card>
                </div>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Connection</div>
                    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                            <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>API Endpoint</label>
                            <input value={prefs.apiEndpoint} onChange={e => set('apiEndpoint')(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Region</label>
                            <select value={prefs.region} onChange={e => set('region')(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, color: THEME.textMain, fontSize: 13, fontFamily: THEME.fontMono, outline: 'none' }}>
                                {['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'].map(r => <option key={r}>{r}</option>)}
                            </select>
                        </div>
                    </Card>
                </div>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 14 }}>Quick Start</div>
                    <Card style={{ padding: 18 }}>
                        <div style={{ fontSize: 12.5, color: THEME.textMuted, marginBottom: 12, lineHeight: 1.6 }}>Initialize the SDK in your application:</div>
                        <div style={{ background: THEME.bg, border: '1px solid rgba(99,102,241,0.10)', borderRadius: 7, padding: '14px 16px', fontSize: 12, fontFamily: THEME.fontMono, color: THEME.textMuted, lineHeight: 1.7 }}>
                            <span style={{ color: THEME.primary }}>import</span> {`{Fathom}`} <span style={{ color: THEME.primary }}>from</span> <span style={{ color: THEME.success }}>'@fathom/sdk'</span><br /><br />
                            <span style={{ color: THEME.primary }}>const</span> sdk = <span style={{ color: THEME.primary }}>new</span> Fathom({'{'}<br />
                            &nbsp;&nbsp;key: <span style={{ color: THEME.success }}>'sk_live_...'</span>,<br />
                            &nbsp;&nbsp;env: <span style={{ color: THEME.success }}>'{prefs.region}'</span><br />
                            {'}'})<br />
                            <span style={{ color: THEME.textMuted, opacity: 0.5 }}>{'// Start tracking events'}</span>
                        </div>
                    </Card>
                </div>
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                <Btn primary onClick={() => toast('Settings saved successfully', 'success')}><Check size={14} />Save Changes</Btn>
                <Btn onClick={() => setPrefs(p => ({ ...p }))}>Reset to Defaults</Btn>
            </div>
        </div>
    );
}

/* ── Dashboard Overview ─────────────────────────────────────────────────── */
function DashboardView({ apps, fetchApps, loading, openModal, onSelectApp }: {
    apps: any[]; fetchApps: () => void; loading: boolean; openModal: () => void; onSelectApp: (app: any) => void;
}) {
    const toast = useToast();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const totalEvents = apps.reduce((s, a) => s + (a.totalEvents24h || 0), 0);
    const totalErrors = apps.reduce((s, a) => s + (a.errorCount || 0), 0);
    const errRate = totalEvents ? ((totalErrors / totalEvents) * 100).toFixed(1) : '0.0';
    const avgLatency = apps.length ? Math.round(apps.reduce((s, a) => s + (a.avgLatency || 0), 0) / apps.length) : 0;
    const sparkApps = useMemo(() => genSparkline(apps.length * 2 + 1, 0.4), [apps.length]);
    const sparkEvts = useMemo(() => genSparkline(totalEvents / 16 + 1, 0.35), [totalEvents]);
    const sparkErr = useMemo(() => genSparkline(parseFloat(errRate) * 1.2 + 0.5, 0.5), [errRate]);
    const sparkLat = useMemo(() => genSparkline(avgLatency * 0.9 + 1, 0.3), [avgLatency]);

    const del = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try { await sdkDelete(`/api/sdk/apps/${id}`); await fetchApps(); toast('Application removed', 'info'); }
        catch (err: any) { toast(err.message || 'Delete failed', 'error'); }
        finally { setDeletingId(null); }
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
            <Loader2 size={30} color={THEME.primary} style={{ animation: 'sdk-spin 0.9s linear infinite' }} />
            <div style={{ fontSize: 10.5, color: THEME.textMuted, letterSpacing: '0.12em', fontFamily: THEME.fontMono }}>LOADING INTEGRATIONS</div>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 30 }}>
                <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>SDK Platform</div>
                    <h1 style={{ fontSize: 25, fontWeight: 800, color: THEME.textMain, margin: 0, letterSpacing: '-0.025em' }}>Integration Overview</h1>
                    <p style={{ fontSize: 12.5, color: THEME.textMuted, marginTop: 6, marginBottom: 0 }}>Aggregated metrics across all registered applications</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Btn onClick={fetchApps} style={{ width: 36, height: 36, padding: 0 }}><RefreshCw size={14} /></Btn>
                    <Btn primary onClick={openModal}><Plus size={14} />Register App</Btn>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 34 }}>
                <StatCard label="Applications" value={apps.length} sub="registered SDKs" Icon={Shield} accentColor={THEME.primaryLight} spark={sparkApps} pct={apps.length * 10} />
                <StatCard label="Events / 24h" value={totalEvents.toLocaleString()} sub="total processed" Icon={Zap} accentColor={THEME.success} spark={sparkEvts} pct={Math.min(100, totalEvents / 200)} />
                <StatCard label="Error Rate" value={`${errRate}%`} sub={`${totalErrors} failed`} Icon={Activity} accentColor={parseFloat(errRate) > 5 ? THEME.danger : THEME.success} spark={sparkErr} pct={parseFloat(errRate) * 5} />
                <StatCard label="Avg Latency" value={`${avgLatency}ms`} sub="across all apps" Icon={Clock} accentColor={THEME.warning} spark={sparkLat} pct={Math.min(100, (avgLatency / 1000) * 100)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: THEME.textMuted, textTransform: 'uppercase' }}>Active Applications ({apps.length})</div>
                {apps.length > 0 && <span style={{ fontSize: 11, color: THEME.textMuted }}>Click any row to view details →</span>}
            </div>

            <Card style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Application', 'Platform', 'Environment', 'Events', 'Errors', 'Latency', 'Uptime', ''].map(h => (
                                <th key={h} style={{ padding: '10px 16px', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: THEME.textMuted, textTransform: 'uppercase', textAlign: 'left', background: THEME.bg, borderBottom: '1px solid rgba(99,102,241,0.10)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {apps.length === 0 && (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 52, color: THEME.textMuted }}>
                                <Shield size={32} color={THEME.textMuted} style={{ opacity: 0.4, margin: '0 auto 10px', display: 'block' }} />
                                No applications registered.{' '}
                                <button onClick={openModal} style={{ background: 'none', border: 'none', color: THEME.primary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Add your first app →</button>
                            </td></tr>
                        )}
                        {apps.map(app => {
                            const evts = app.totalEvents24h || 0;
                            const errs = app.errorCount || 0;
                            const eP = evts ? (errs / evts * 100).toFixed(1) : '0.0';
                            const latMs = app.avgLatency || 0;
                            const lC = latencyColor(latMs);
                            const uptime = app.uptime ?? 99.5;
                            return (
                                <tr key={app.id} onClick={() => onSelectApp(app)}
                                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)' }}>
                                        <div style={{ fontWeight: 700, fontSize: 13.5, color: THEME.textMain }}>{app.name}</div>
                                        <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 2, fontFamily: THEME.fontMono }}>ID: {app.id}</div>
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)' }}>
                                        <span style={{ fontSize: 11.5, color: THEME.textMuted, background: THEME.bg, padding: '3px 9px', borderRadius: 5, fontWeight: 600, border: '1px solid rgba(99,102,241,0.10)' }}>{platformLabel(app.app_type || app.platform || 'custom')}</span>
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)' }}><EnvTag env={app.environment || app.env || 'development'} /></td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)', fontFamily: THEME.fontMono, fontSize: 13, color: THEME.textMain }}>{evts.toLocaleString()}</td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)' }}>
                                        <span style={{ fontFamily: THEME.fontMono, fontSize: 13, color: errs > 0 ? THEME.danger : THEME.success }}>{errs}</span>
                                        {evts > 0 && <span style={{ fontSize: 9.5, color: THEME.textMuted, marginLeft: 4 }}>({eP}%)</span>}
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)' }}>
                                        <span style={{ fontFamily: THEME.fontMono, fontSize: 13, color: lC }}>{latMs}ms</span>
                                        <div style={{ height: 3, borderRadius: 99, background: THEME.glassBorder, overflow: 'hidden', width: 56, marginTop: 5 }}>
                                            <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, (latMs / 1000) * 100)}%`, background: lC }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)' }}>
                                        <span style={{ fontFamily: THEME.fontMono, fontSize: 12.5, color: uptime >= 99 ? THEME.success : uptime >= 95 ? THEME.warning : THEME.danger }}>{uptime}%</span>
                                    </td>
                                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(99,102,241,0.05)', width: 44 }}>
                                        <button onClick={e => del(e, app.id)} disabled={deletingId === app.id}
                                            style={{ background: 'transparent', border: 'none', color: THEME.textMuted, cursor: 'pointer', padding: 6, borderRadius: 6, display: 'inline-flex' }}
                                            onMouseEnter={e => (e.currentTarget.style.color = THEME.danger)}
                                            onMouseLeave={e => (e.currentTarget.style.color = THEME.textMuted)}>
                                            {deletingId === app.id ? <Loader2 size={13} style={{ animation: 'sdk-spin 0.9s linear infinite' }} /> : <Trash2 size={13} />}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════════════ */
export default function SDKDashboardTab() {
    useAdaptiveTheme();

    const [mainTab, setMainTab] = useState<'overview' | 'events' | 'logs' | 'settings'>('overview');
    const [apps, setApps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [showModal, setShowModal] = useState(false);

    const fetchApps = useCallback(async () => {
        try {
            const data = await sdkFetch('/api/sdk/apps');
            setApps(Array.isArray(data) ? data : data?.apps || []);
        } catch (err) {
            console.error('[SDK] fetch error:', err);
        }
    }, []);

    useGlobalRefresh(fetchApps);

    useEffect(() => {
        fetchApps().finally(() => setLoading(false));
        const iv = setInterval(fetchApps, 30000);
        return () => clearInterval(iv);
    }, [fetchApps]);

    const errorCount = apps.reduce((s, a) => s + (a.errorCount || 0), 0);

    const navItems = [
        { id: 'overview', label: 'Overview', Icon: BarChart2 },
        { id: 'events', label: 'Event Stream', Icon: Activity },
        { id: 'logs', label: 'Logs', Icon: Terminal, badge: errorCount > 0 ? Math.min(errorCount, 99) : null },
        { id: 'settings', label: 'Settings', Icon: Settings },
    ] as const;

    return (
        <ToastProvider>
            <style>{`
                @keyframes sdk-spin { to { transform: rotate(360deg); } }
                @keyframes sdk-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
                @keyframes sdk-slideRight { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
                @keyframes sdk-toastIn { from { transform:translateY(100%); opacity:0; } to { transform:translateY(0); opacity:1; } }
                @keyframes sdk-blink { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: THEME.bg }}>

                {/* Sub-tab bar (replaces the nested dark sidebar — keeps SDK navigation but uses the same horizontal-tab pattern as the rest of the app) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 28px', borderBottom: `1px solid ${THEME.glassBorder}`, background: THEME.surface, flexShrink: 0, overflowX: 'auto' }}>
                    {navItems.map(n => {
                        const active = !selectedApp && mainTab === n.id;
                        return (
                            <button key={n.id} onClick={() => { setSelectedApp(null); setMainTab(n.id); }}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${active ? THEME.primary : 'transparent'}`,
                                    background: active ? `${THEME.primary}12` : 'transparent',
                                    color: active ? THEME.primary : THEME.textMuted,
                                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                                    fontWeight: active ? 700 : 500,
                                    transition: THEME.transitionFast,
                                    whiteSpace: 'nowrap',
                                }}>
                                <n.Icon size={13} style={{ flexShrink: 0 }} />
                                <span>{n.label}</span>
                                {(n as any).badge && (
                                    <span style={{ minWidth: 18, height: 18, padding: '0 5px', background: THEME.danger, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {(n as any).badge > 9 ? '9+' : (n as any).badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}

                    {selectedApp && (
                        <>
                            <span style={{ width: 1, height: 18, background: THEME.glassBorder, margin: '0 8px' }} />
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8, background: `${THEME.primary}12`, border: `1px solid ${THEME.primary}30`, fontSize: 12 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.primary }} />
                                <span style={{ color: THEME.textMain, fontWeight: 600 }}>{selectedApp.name}</span>
                                <span style={{ fontSize: 10, color: THEME.textMuted, fontFamily: THEME.fontMono }}>· {selectedApp.id}</span>
                                <button onClick={() => setSelectedApp(null)} title="Close app detail"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.textDim, padding: 0, marginLeft: 4, display: 'inline-flex', alignItems: 'center', fontSize: 14, lineHeight: 1 }}>×</button>
                            </span>
                        </>
                    )}

                    <div style={{ flex: 1 }} />

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: THEME.textMuted }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: THEME.success, animation: 'sdk-blink 2.2s ease-in-out infinite' }} />
                        All systems operational
                    </span>
                </div>

                {/* Main content */}
                <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                    {selectedApp ? (
                        <AppDetail
                            app={selectedApp}
                            onBack={() => setSelectedApp(null)}
                            onDelete={id => { setApps(p => p.filter(a => a.id !== id)); setSelectedApp(null); }}
                            onUpdate={(id, patch) => setApps(p => p.map(a => a.id === id ? { ...a, ...patch } : a))}
                        />
                    ) : (
                        <>
                            {mainTab === 'overview' && (
                                <DashboardView
                                    apps={apps}
                                    fetchApps={() => { setLoading(true); fetchApps().finally(() => setLoading(false)); }}
                                    loading={loading}
                                    openModal={() => setShowModal(true)}
                                    onSelectApp={setSelectedApp}
                                />
                            )}
                            {mainTab === 'events' && <EventStreamView apps={apps} />}
                            {mainTab === 'logs' && <LogsView />}
                            {mainTab === 'settings' && <SettingsView />}
                        </>
                    )}
                </main>
            </div>

            <RegisterModal
                open={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={app => { setApps(prev => [...prev, app]); setShowModal(false); }}
            />
        </ToastProvider>
    );
}
