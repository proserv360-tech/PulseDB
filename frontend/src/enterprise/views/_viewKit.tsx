// ==========================================================================
//  FATHOM — Shared view kit for the Observability/Admin pages
// ==========================================================================
//  These pages (RedisOverview, ElasticsearchOverview, DetectorPicker,
//  TraceDetail, NotifierSettings) used to use ad-hoc Tailwind utility
//  classes that did not match the rest of the app's inline-style + THEME
//  aesthetic. This module provides a small set of theme-aware building
//  blocks so each page renders consistently in both light and dark mode.
// ==========================================================================

import React, { CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { THEME } from '../../utils/theme';

const FONT_UI = `'Outfit', system-ui, sans-serif`;
const FONT_MONO = `'JetBrains Mono', 'Fira Code', monospace`;

// ─── Page shell ──────────────────────────────────────────────────────────────
export const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
        style={{
            padding: '24px 28px',
            minHeight: '100vh',
            background: THEME.bg,
            color: THEME.textMain,
            fontFamily: FONT_UI,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
        }}
    >
        {children}
    </div>
);

// ─── Page header (icon + title + optional subtitle + refresh button) ────────
export const PageHeader: React.FC<{
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    accent?: string;
    onRefresh?: () => void;
    refreshing?: boolean;
    right?: React.ReactNode;
}> = ({ icon, title, subtitle, accent = THEME.primary, onRefresh, refreshing, right }) => (
    <header
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 14,
            padding: '14px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
                style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `${accent}15`,
                    border: `1px solid ${accent}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accent,
                    flexShrink: 0,
                }}
            >
                {icon}
            </div>
            <div style={{ minWidth: 0 }}>
                <h1
                    style={{
                        margin: 0,
                        fontSize: 17,
                        fontWeight: 700,
                        color: THEME.textMain,
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p
                        style={{
                            margin: '2px 0 0',
                            fontSize: 12,
                            color: THEME.textMuted,
                        }}
                    >
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {right}
            {onRefresh && (
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label="Refresh"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 14px',
                        background: THEME.primary + '14',
                        border: `1px solid ${THEME.primary}30`,
                        borderRadius: 10,
                        color: THEME.primary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: refreshing ? 'wait' : 'pointer',
                        opacity: refreshing ? 0.6 : 1,
                        fontFamily: FONT_UI,
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        if (!refreshing) e.currentTarget.style.background = THEME.primary + '24';
                    }}
                    onMouseLeave={(e) => {
                        if (!refreshing) e.currentTarget.style.background = THEME.primary + '14';
                    }}
                >
                    <RefreshCw
                        size={13}
                        style={{
                            animation: refreshing ? 'spin 1s linear infinite' : undefined,
                        }}
                    />
                    Refresh
                </button>
            )}
        </div>
    </header>
);

// ─── Card ────────────────────────────────────────────────────────────────────
export const Card: React.FC<{
    title?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
    style?: CSSProperties;
}> = ({ title, right, children, style }) => (
    <section
        style={{
            background: THEME.surface,
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: 14,
            padding: 18,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            fontFamily: FONT_UI,
            ...style,
        }}
    >
        {(title || right) && (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                }}
            >
                {title && (
                    <h2
                        style={{
                            margin: 0,
                            fontSize: 11,
                            fontWeight: 700,
                            color: THEME.textDim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}
                    >
                        {title}
                    </h2>
                )}
                {right}
            </div>
        )}
        {children}
    </section>
);

// ─── Key/value row ───────────────────────────────────────────────────────────
export const KV: React.FC<{
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}> = ({ label, value, mono }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            padding: '7px 0',
            borderBottom: `1px solid ${THEME.glassBorder}`,
            fontSize: 13,
        }}
    >
        <span style={{ color: THEME.textMuted }}>{label}</span>
        <span
            style={{
                color: THEME.textMain,
                fontFamily: mono ? FONT_MONO : FONT_UI,
                fontWeight: 500,
                textAlign: 'right',
                wordBreak: 'break-all',
            }}
        >
            {value ?? '—'}
        </span>
    </div>
);

// ─── KV grid (for short stats) ───────────────────────────────────────────────
export const KVGrid: React.FC<{
    columns?: number;
    items: Array<{ label: string; value: React.ReactNode; mono?: boolean }>;
}> = ({ columns = 4, items }) => (
    <div
        style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: '6px 24px',
        }}
    >
        {items.map((it) => (
            <KV key={it.label} label={it.label} value={it.value} mono={it.mono} />
        ))}
    </div>
);

// ─── Button ──────────────────────────────────────────────────────────────────
export const Button: React.FC<{
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'button' | 'submit';
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    disabled?: boolean;
    children: React.ReactNode;
    style?: CSSProperties;
    ariaLabel?: string;
}> = ({
    onClick,
    type = 'button',
    variant = 'secondary',
    size = 'md',
    disabled,
    children,
    style,
    ariaLabel,
}) => {
    const palette = {
        primary: { bg: THEME.primary + '22', border: THEME.primary + '55', color: THEME.primary, hover: THEME.primary + '36' },
        secondary: { bg: THEME.surfaceHover, border: THEME.glassBorder, color: THEME.textMain, hover: THEME.surface },
        danger: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.30)', color: THEME.danger, hover: 'rgba(220,38,38,0.14)' },
        ghost: { bg: 'transparent', border: THEME.glassBorder, color: THEME.textMuted, hover: THEME.surfaceHover },
    }[variant];

    const sizes = {
        sm: { padding: '6px 10px', fontSize: 12 },
        md: { padding: '9px 16px', fontSize: 13 },
    }[size];

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                color: palette.color,
                fontWeight: 600,
                fontFamily: FONT_UI,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.15s',
                ...sizes,
                ...style,
            }}
            onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.background = palette.hover;
            }}
            onMouseLeave={(e) => {
                if (!disabled) e.currentTarget.style.background = palette.bg;
            }}
        >
            {children}
        </button>
    );
};

// ─── Input / Select / Textarea (theme-aware) ────────────────────────────────
const inputBase = (extra?: CSSProperties): CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    background: THEME.surfaceHover,
    border: `1px solid ${THEME.glassBorder}`,
    borderRadius: 10,
    padding: '9px 12px',
    color: THEME.textMain,
    fontSize: 13,
    fontFamily: FONT_UI,
    outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
    ...extra,
});

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }> = ({
    mono,
    style,
    ...rest
}) => (
    <input
        {...rest}
        style={{
            ...inputBase(mono ? { fontFamily: FONT_MONO } : undefined),
            ...style,
        }}
        onFocus={(e) => {
            e.currentTarget.style.borderColor = THEME.primary;
            e.currentTarget.style.background = THEME.surface;
            rest.onFocus?.(e);
        }}
        onBlur={(e) => {
            e.currentTarget.style.borderColor = THEME.glassBorder;
            e.currentTarget.style.background = THEME.surfaceHover;
            rest.onBlur?.(e);
        }}
    />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
    style,
    children,
    ...rest
}) => (
    <select {...rest} style={{ ...inputBase(), cursor: 'pointer', ...style }}>
        {children}
    </select>
);

export const Textarea: React.FC<
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }
> = ({ mono, style, ...rest }) => (
    <textarea
        {...rest}
        style={{
            ...inputBase(mono ? { fontFamily: FONT_MONO, fontSize: 12 } : undefined),
            resize: 'vertical',
            ...style,
        }}
    />
);

// ─── Alert (for errors / info) ───────────────────────────────────────────────
export const Alert: React.FC<{
    variant?: 'error' | 'info';
    children: React.ReactNode;
}> = ({ variant = 'error', children }) => {
    const c = variant === 'error' ? THEME.danger : THEME.primary;
    return (
        <div
            role={variant === 'error' ? 'alert' : undefined}
            style={{
                background: `${c}10`,
                border: `1px solid ${c}40`,
                color: c,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontFamily: FONT_UI,
            }}
        >
            {children}
        </div>
    );
};

// ─── Empty / loading text ────────────────────────────────────────────────────
export const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p style={{ margin: 0, fontSize: 13, color: THEME.textMuted, fontFamily: FONT_UI }}>{children}</p>
);

// ─── Table ───────────────────────────────────────────────────────────────────
export const Table: React.FC<{
    columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center'; mono?: boolean }>;
    rows: Array<Record<string, React.ReactNode>>;
    emptyText?: string;
    rowKey?: (row: any, idx: number) => string;
}> = ({ columns, rows, emptyText = 'No data.', rowKey }) => {
    if (rows.length === 0) return <Muted>{emptyText}</Muted>;
    return (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${THEME.glassBorder}` }}>
            <table
                style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    fontFamily: FONT_UI,
                }}
            >
                <thead>
                    <tr style={{ background: THEME.surfaceHover }}>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                style={{
                                    textAlign: c.align || 'left',
                                    padding: '10px 14px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: THEME.textDim,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                }}
                            >
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, idx) => (
                        <tr
                            key={rowKey ? rowKey(r, idx) : idx}
                            style={{ borderBottom: `1px solid ${THEME.glassBorder}` }}
                        >
                            {columns.map((c) => (
                                <td
                                    key={c.key}
                                    style={{
                                        textAlign: c.align || 'left',
                                        padding: '10px 14px',
                                        color: THEME.textMain,
                                        fontFamily: c.mono ? FONT_MONO : FONT_UI,
                                        fontSize: c.mono ? 12 : 13,
                                    }}
                                >
                                    {r[c.key] ?? '—'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─── Status pill ─────────────────────────────────────────────────────────────
export const StatusPill: React.FC<{
    label: string;
    color: string;
}> = ({ label, color }) => (
    <span
        style={{
            display: 'inline-block',
            padding: '3px 10px',
            background: `${color}18`,
            border: `1px solid ${color}40`,
            color,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontFamily: FONT_UI,
        }}
    >
        {label}
    </span>
);

export { FONT_UI, FONT_MONO };
