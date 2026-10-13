/**
 * Atomic UI components.
 *
 * These are truly stateless presentational pieces with no business logic.
 * They accept only primitive props and render deterministically.
 */

import React, { useState } from 'react';
import { T } from '../../constants/theme';
import { THEME } from '../../../utils/theme';
import { ROLES, PERM_COLORS } from '../../constants/index';
import { relTime } from '../../helpers/index';

/* ─── SVG Icon ──────────────────────────────────────────────────────────────── */
export const ICONS = {
    users:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    lock:     "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
    plus:     "M12 5v14M5 12h14",
    search:   "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
    trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
    edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    x:        "M18 6 6 18M6 6l12 12",
    check:    "M20 6 9 17l-5-5",
    chevRight:"M9 18l6-6-6-6",
    chevLeft: "M15 18l-6-6 6-6",
    chevDown: "M6 9l6 6 6-6",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    key:      "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    refresh:  "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    mail:     "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    eyeOff:   "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1.97 1.97a3 3 0 0 0 4.24 4.24m6.58 5.58a3 3 0 0 0-4.24-4.24",
    copy:     "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1",
    alert:    "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
    database: "M12 2C6.48 2 2 4.02 2 6.5v11C2 19.98 6.48 22 12 22s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2zm0 2c4.42 0 8 1.57 8 3.5S16.42 11 12 11 4 9.43 4 7.5 7.58 4 12 4z",
    logOut:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    sort:     "M3 6h18M7 12h10M11 18h2",
    clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    globe:    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
    phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.4 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3",
    more:     "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    arrowUp:  "M12 19V5M5 12l7-7 7 7",
    arrowDown:"M12 5v14M5 12l7 7 7-7",
    save:     "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
    grid:     "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    filter:   "M22 3H2l8 9.46V19l4 2v-8.54L22 3",
    cpu:      "M12 2a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v4h2a2 2 0 0 1 0 4h-2v4a2 2 0 0 1-2 2h-4v2a2 2 0 0 1-4 0v-2H6a2 2 0 0 1-2-2v-4H2a2 2 0 0 1 0-4h2V8a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2z",
};

/** Generic SVG icon driven by a path string */
export const Ico = ({ name, size = 16, color = 'currentColor', style = {} }) => (
    <svg
        width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, ...style }}
    >
        <path d={ICONS[name] || ''} />
    </svg>
);

/* ─── Sparkline bar chart ─────────────────────────────────────────────────── */
export const Sparkline = ({ data, color = T.primary, height = 28 }) => {
    const max = Math.max(...data, 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
            {data.map((v, i) => {
                const opacity = v > max * 0.7 ? 'dd' : '66';
                return (
                    <div key={i} style={{
                        flex: 1, minWidth: 3, borderRadius: '12px',
                        height: `${(v / max) * 100}%`,
                        background: v === 0 ? T.glassBorder : `${color}${opacity}`,
                        transition: 'height 0.3s',
                    }} />
                );
            })}
        </div>
    );
};

/* ─── SVG ring for risk score ─────────────────────────────────────────────── */
export const RiskRing = ({ score, size = 44 }) => {
    const color = score > 70 ? T.danger : score > 40 ? T.warning : T.success;
    const r = size / 2 - 4;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    return (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.glassBorder} strokeWidth="3" />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
            </svg>
            <span style={{ position: 'absolute', fontSize: 11, fontWeight: 700, color, fontFamily: THEME.fontMono }}>
                {score}
            </span>
        </div>
    );
};

/* ─── Login heat-map (28 days) ────────────────────────────────────────────── */
export const LoginHeatmap = ({ data }) => {
    const weeks = [];
    for (let w = 0; w < 4; w++) weeks.push(data.slice(w * 7, w * 7 + 7));
    return (
        <div style={{ display: 'flex', gap: 3 }}>
            {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {week.map((val, di) => {
                        let bgColor: string;
                        if (val === 0) {
                            bgColor = T.glassBorder;
                        } else if (val < 3) {
                            bgColor = `${T.primary}44`;
                        } else if (val < 6) {
                            bgColor = `${T.primary}88`;
                        } else {
                            bgColor = T.primary;
                        }
                        return (
                            <div key={di} title={`${val} logins`} style={{
                                width: 12, height: 12, borderRadius: 16,
                                background: bgColor,
                                cursor: 'default',
                            }} />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

/* ─── Status badge ────────────────────────────────────────────────────────── */
export const StatusBadge = ({ status }) => {
    const cfgMap = {
        active:    { color: T.success, bg: T.successDim, dot: '•', label: 'Active' },
        inactive:  { color: T.textDim, bg: `${T.textDim}18`, dot: '○', label: 'Inactive' },
        suspended: { color: T.danger,  bg: T.dangerDim,  dot: '✕', label: 'Suspended' },
    };
    const cfg = cfgMap[status] || { color: T.textDim, bg: T.glassBorder, dot: '?', label: status };
    const borderOpacity = '30';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: '12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}${borderOpacity}`,
        }}>
            <span style={{ fontSize: 8, animation: status === 'active' ? 'umPulse 2s infinite' : 'none' }}>
                {cfg.dot}
            </span>
            {cfg.label}
        </span>
    );
};

/* ─── Role badge ─────────────────────────────────────────────────────────── */
export const RoleBadge = ({ roleId, size = 'md' }) => {
    const role = ROLES.find(r => r.id === roleId) || ROLES[4];
    const sm = size === 'sm';
    const bgOpacity = '18';
    const borderOpacity = '35';
    return (
        <span style={{
            fontFamily: THEME.fontMono,
            fontSize: sm ? 10 : 11, fontWeight: 700,
            color: role.color,
            background: `${role.color}${bgOpacity}`,
            border: `1px solid ${role.color}${borderOpacity}`,
            borderRadius: 12,
            padding: sm ? '2px 6px' : '3px 8px',
        }}>
            {role.badge} {role.label}
        </span>
    );
};

/* ─── MFA badge ─────────────────────────────────────────────────────────── */
export const MfaBadge = ({ enabled }) => {
    const borderOpacity = '30';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
            background: enabled ? T.successDim : T.dangerDim,
            color:      enabled ? T.success    : T.danger,
            border:     `1px solid ${enabled ? T.success : T.danger}${borderOpacity}`,
        }}>
            <Ico name={enabled ? 'shield' : 'alert'} size={10} />
            {enabled ? 'MFA' : 'No MFA'}
        </span>
    );
};

/* ─── Metric / stat card ──────────────────────────────────────────────────── */
export const StatCard = ({ label, value, sub, icon, color = T.primary, trend, sparkData, onClick }) => (
    <div onClick={onClick} style={{
        background: T.surface, border: `1px solid ${T.glassBorder}`, borderRadius: 20,
        padding: 20, cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s',
    }}>
        {/* Ghost icon watermark */}
        <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.06, transform: 'scale(2.5)' }}>
            <Ico name={icon} size={48} color={color} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: `${color}18`, border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Ico name={icon} size={16} color={color} />
            </div>
            {trend !== undefined && (
                <span style={{ fontSize: 11, fontWeight: 700, color: trend >= 0 ? T.success : T.danger, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Ico name={trend >= 0 ? 'arrowUp' : 'arrowDown'} size={11} color={trend >= 0 ? T.success : T.danger} />
                    {Math.abs(trend)}%
                </span>
            )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.textMain, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.textSub, marginTop: 4, fontWeight: 500 }}>{label}</div>
        {sub       && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{sub}</div>}
        {sparkData && <div style={{ marginTop: 12 }}><Sparkline data={sparkData} color={color} height={24} /></div>}
    </div>
);

/* ─── Toast notification stack ────────────────────────────────────────────── */
export const Toast = ({ toasts }) => (
    <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 600, display: 'flex', flexDirection: 'column', gap: 20, pointerEvents: 'none' }}>
        {toasts.map(t => {
            const borderOpacity = '40';
            return (
                <div key={t.id} style={{
                    padding: '12px 18px', borderRadius: 12,
                    background:  t.type === 'success' ? T.successDim : t.type === 'error' ? T.dangerDim : T.primaryDim,
                    border:      `1px solid ${t.type === 'success' ? T.success : t.type === 'error' ? T.danger : T.primary}${borderOpacity}`,
                    display: 'flex', alignItems: 'center', gap: 22,
                    boxShadow: `${T.shadowMd}`,
                    animation: 'umSlideRight 0.3s ease',
                    backdropFilter: 'blur(12px)',
                    pointerEvents: 'auto',
                }}>
                    <Ico
                        name={t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'activity'}
                        size={15}
                        color={t.type === 'success' ? T.success : t.type === 'error' ? T.danger : T.primary}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textMain }}>{t.message}</span>
                </div>
            );
        })}
    </div>
);

/* ─── Tag/pill filter button ──────────────────────────────────────────────── */
export const TagFilter = ({ label, active, onClick, activeColor }) => (
    <button onClick={onClick} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s',
        background: active ? (activeColor ? `${activeColor}15` : T.primaryDim) : 'transparent',
        border:     `1px solid ${active ? (activeColor || T.primary) : T.glassBorder}`,
        color:      active ? (activeColor || T.primary) : T.textDim,
    }}>
        {label}
    </button>
);

/* ─── Form field wrapper (label + error) ──────────────────────────────────── */
export const FormField = ({ label, error, required, children }) => (
    <div>
        <label style={{
            display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6,
            color: error ? T.danger : T.textMuted,
            letterSpacing: '0.02em',
        }}>
            {label}{required && <span style={{ color: T.danger, marginLeft: 3 }}>*</span>}
        </label>
        {children}
        {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{error}</div>}
    </div>
);

/* ─── Toggle switch ────────────────────────────────────────────────────────── */
export const Toggle = ({ value, onChange, color = T.success }) => (
    <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
            width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
            background: value ? color : T.glassBorder, border: 'none',
            position: 'relative', transition: 'background 0.2s',
        }}
    >
        <div style={{
            width: 20, height: 20, borderRadius: 16, background: 'white',
            position: 'absolute', top: 3, transition: 'left 0.2s',
            left: value ? 24 : 4, boxShadow: `${T.shadowSm}`,
        }} />
    </button>
);
