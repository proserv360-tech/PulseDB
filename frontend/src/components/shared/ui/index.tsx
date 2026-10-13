// ==========================================================================
//  FATHOM — Shared UI Components
// ==========================================================================
//
//  Reusable building blocks consumed across tabs.
//  All components read from the mutable THEME object so they automatically
//  respond to dark/light toggles without prop-drilling.
//
//  Usage:
//    import { GlassCard, EmptyState, ErrorState, StatusBadge, Modal } from '@/components/shared/ui';
// ==========================================================================

import React, { useEffect, useCallback } from 'react';
import { THEME } from '../../../utils/theme';
import { ANIM } from '../../../config/animations';
import { TYPO } from '../../../config/typography';
import { sp, GAP, PAD } from '../../../config/spacing';
import { Z } from '../../../config/designTokens';
import { AlertTriangle, Database, Inbox, X, Loader } from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  GlassCard — standard container with glass morphism
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface GlassCardProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    accent?: string;
    onClick?: () => void;
    hoverable?: boolean;
    className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children, style, accent, onClick, hoverable = false, className,
}) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <div
            className={className}
            onClick={onClick}
            onMouseEnter={() => hoverable && setHovered(true)}
            onMouseLeave={() => hoverable && setHovered(false)}
            style={{
                background:     THEME.glass,
                border:         `1px solid ${hovered ? THEME.glassBorderHover : THEME.glassBorder}`,
                borderRadius:   THEME.radiusMd,
                ...PAD.card,
                transition:     THEME.transitionFast,
                cursor:         onClick ? 'pointer' : 'default',
                ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
                ...(hovered ? { transform: 'translateY(-2px)', boxShadow: THEME.shadowMd } : {}),
                ...style,
            }}
        >
            {children}
        </div>
    );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  EmptyState — "nothing here yet" placeholder
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface EmptyStateProps {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    action?: React.ReactNode;
    style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title = 'No data yet',
    description,
    action,
    style,
}) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: `${sp(15)} ${sp(5)}`,
        animation: ANIM.fadeUp,
        ...style,
    }}>
        <div style={{
            width: 64, height: 64, borderRadius: THEME.radiusLg,
            background: THEME.primaryFaint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: sp(4),
        }}>
            {icon || <Inbox size={28} color={THEME.textDim} />}
        </div>
        <h3 style={{
            ...TYPO.h3,
            color: THEME.textMain,
            marginBottom: sp(2),
        }}>{title}</h3>
        {description && (
            <p style={{
                ...TYPO.bodySmall,
                color: THEME.textMuted,
                maxWidth: 360,
                marginBottom: action ? sp(5) : 0,
            }}>{description}</p>
        )}
        {action}
    </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ErrorState — error display with retry
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'Something went wrong',
    message,
    onRetry,
    style,
}) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: `${sp(15)} ${sp(5)}`,
        animation: ANIM.fadeUp,
        ...style,
    }}>
        <div style={{
            width: 64, height: 64, borderRadius: THEME.radiusLg,
            background: `${THEME.danger}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: sp(4),
        }}>
            <AlertTriangle size={28} color={THEME.danger} />
        </div>
        <h3 style={{
            ...TYPO.h3,
            color: THEME.textMain,
            marginBottom: sp(2),
        }}>{title}</h3>
        {message && (
            <p style={{
                ...TYPO.bodySmall,
                color: THEME.textMuted,
                maxWidth: 400,
                marginBottom: onRetry ? sp(5) : 0,
            }}>{message}</p>
        )}
        {onRetry && (
            <button onClick={onRetry} style={{
                ...TYPO.button,
                ...PAD.button,
                background: `${THEME.danger}18`,
                color: THEME.danger,
                border: `1px solid ${THEME.danger}30`,
                borderRadius: THEME.radiusSm,
                cursor: 'pointer',
                transition: THEME.transitionFast,
            }}>
                Try Again
            </button>
        )}
    </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  StatusBadge — colored status indicator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatusBadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    dot?: boolean;
    style?: React.CSSProperties;
}

const badgeColors: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
    get success()  { return { bg: `${THEME.success}18`, text: THEME.success,  dot: THEME.success  }; },
    get danger()   { return { bg: `${THEME.danger}18`,  text: THEME.danger,   dot: THEME.danger   }; },
    get warning()  { return { bg: `${THEME.warning}18`, text: THEME.warning,  dot: THEME.warning  }; },
    get info()     { return { bg: `${THEME.info}18`,    text: THEME.info,     dot: THEME.info     }; },
    get neutral()  { return { bg: `${THEME.textDim}15`, text: THEME.textMuted, dot: THEME.textMuted }; },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    variant = 'neutral', children, dot = false, style,
}) => {
    const colors = badgeColors[variant];
    return (
        <span style={{
            ...TYPO.badge,
            display: 'inline-flex', alignItems: 'center', gap: GAP.xs,
            ...PAD.badge,
            background: colors.bg,
            color: colors.text,
            borderRadius: THEME.radiusFull,
            whiteSpace: 'nowrap',
            ...style,
        }}>
            {dot && (
                <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: colors.dot, flexShrink: 0,
                }} />
            )}
            {children}
        </span>
    );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Modal — standardised overlay dialog
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: number | string;
    accentColor?: string;
}

export const Modal: React.FC<ModalProps> = ({
    open, onClose, title, subtitle, icon, children, footer,
    width = 560, accentColor,
}) => {
    // Close on Escape
    const handleKey = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (open) {
            document.addEventListener('keydown', handleKey);
            return () => document.removeEventListener('keydown', handleKey);
        }
    }, [open, handleKey]);

    if (!open) return null;

    const accent = accentColor || THEME.primary;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: Z.overlay,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute', inset: 0,
                    background: THEME.bg,
                    zIndex: 0,
                }}
            />

            {/* Dialog */}
            <div style={{
                position: 'relative', zIndex: 1,
                width, maxWidth: '95vw', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: THEME.radiusLg,
                boxShadow: THEME.shadowDeep,
                overflow: 'hidden',
                animation: ANIM.modalIn,
            }}>
                {/* Accent bar */}
                <div style={{
                    height: 3,
                    background: `linear-gradient(90deg, ${accent}, ${accent}88, ${accent}44)`,
                }} />

                {/* Header */}
                {(title || icon) && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: GAP.md,
                        padding: `${sp(4)} ${sp(5)}`,
                        borderBottom: `1px solid ${THEME.glassBorder}`,
                        position: 'sticky', top: 0, zIndex: 2,
                        background: THEME.surface,
                    }}>
                        {icon && (
                            <div style={{
                                width: 36, height: 36, borderRadius: THEME.radiusSm,
                                background: `${accent}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                {icon}
                            </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {title && <h3 style={{ ...TYPO.h4, color: THEME.textMain }}>{title}</h3>}
                            {subtitle && <p style={{ ...TYPO.bodySmall, color: THEME.textMuted, marginTop: 2 }}>{subtitle}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                width: 32, height: 32, borderRadius: THEME.radiusSm,
                                border: 'none',
                                background: `${THEME.textDim}15`,
                                color: THEME.textMuted,
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: THEME.transitionFast,
                                flexShrink: 0,
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Body */}
                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: `${sp(5)} ${sp(5)}`,
                }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        gap: GAP.md,
                        padding: `${sp(3)} ${sp(5)}`,
                        borderTop: `1px solid ${THEME.glassBorder}`,
                        position: 'sticky', bottom: 0,
                        background: THEME.surface,
                    }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PrimaryButton / SecondaryButton — standard action buttons
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    color?: string;
    size?: 'sm' | 'md';
    style?: React.CSSProperties;
    type?: 'button' | 'submit';
}

export const PrimaryButton: React.FC<ButtonProps> = ({
    children, onClick, disabled, loading, icon, color, size = 'md', style, type = 'button',
}) => {
    const accent = color || THEME.primary;
    const pad = size === 'sm' ? PAD.buttonSm : PAD.button;
    const typo = size === 'sm' ? TYPO.buttonSmall : TYPO.button;
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            style={{
                ...typo,
                ...pad,
                display: 'inline-flex', alignItems: 'center', gap: GAP.sm,
                background: disabled ? THEME.textDim : accent,
                color: '#fff',
                border: 'none',
                borderRadius: THEME.radiusSm,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: THEME.transitionFast,
                whiteSpace: 'nowrap',
                ...style,
            }}
        >
            {loading ? <Loader size={14} style={{ animation: ANIM.spin }} /> : icon}
            {children}
        </button>
    );
};

export const SecondaryButton: React.FC<ButtonProps> = ({
    children, onClick, disabled, loading, icon, color, size = 'md', style, type = 'button',
}) => {
    const accent = color || THEME.textMuted;
    const pad = size === 'sm' ? PAD.buttonSm : PAD.button;
    const typo = size === 'sm' ? TYPO.buttonSmall : TYPO.button;
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            style={{
                ...typo,
                ...pad,
                display: 'inline-flex', alignItems: 'center', gap: GAP.sm,
                background: 'transparent',
                color: accent,
                border: `1px solid ${accent}40`,
                borderRadius: THEME.radiusSm,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: THEME.transitionFast,
                whiteSpace: 'nowrap',
                ...style,
            }}
        >
            {loading ? <Loader size={14} style={{ animation: ANIM.spin }} /> : icon}
            {children}
        </button>
    );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LoadingSpinner — standardized loading indicator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface LoadingSpinnerProps {
    size?: number;
    color?: string;
    label?: string;
    style?: React.CSSProperties;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 20, color, label, style,
}) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: GAP.md,
        padding: sp(8),
        ...style,
    }}>
        <Loader size={size} color={color || THEME.primary} style={{ animation: ANIM.spin }} />
        {label && <span style={{ ...TYPO.bodySmall, color: THEME.textMuted }}>{label}</span>}
    </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SectionHeader — reusable section title with optional subtitle + action
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    accent?: string;
    style?: React.CSSProperties;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    title, subtitle, action, accent, style,
}) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: sp(4),
        ...style,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: GAP.md }}>
            {accent && (
                <div style={{
                    width: 3, height: 20, borderRadius: 2,
                    background: accent,
                }} />
            )}
            <div>
                <h3 style={{ ...TYPO.h4, color: THEME.textMain }}>{title}</h3>
                {subtitle && (
                    <p style={{ ...TYPO.bodySmall, color: THEME.textMuted, marginTop: 2 }}>{subtitle}</p>
                )}
            </div>
        </div>
        {action}
    </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FormField — standardized form input wrapper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
}

export const FormField: React.FC<FormFieldProps> = ({
    label, required, error, hint, children, style,
}) => (
    <div style={{ marginBottom: sp(4), ...style }}>
        <label style={{
            ...TYPO.label,
            display: 'block',
            color: THEME.textMuted,
            marginBottom: sp(1.5),
        }}>
            {label}
            {required && <span style={{ color: THEME.danger, marginLeft: 4 }}>*</span>}
        </label>
        {children}
        {error && (
            <p style={{ ...TYPO.caption, color: THEME.danger, marginTop: sp(1) }}>{error}</p>
        )}
        {!error && hint && (
            <p style={{ ...TYPO.caption, color: THEME.textDim, marginTop: sp(1) }}>{hint}</p>
        )}
    </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TextInput — themed text input
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: boolean;
    icon?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
    error, icon, style, ...props
}) => (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
            <div style={{
                position: 'absolute', left: 12,
                color: THEME.textDim, pointerEvents: 'none',
                display: 'flex', alignItems: 'center',
            }}>
                {icon}
            </div>
        )}
        <input
            {...props}
            style={{
                width: '100%',
                ...PAD.input,
                ...(icon ? { paddingLeft: 38 } : {}),
                ...TYPO.body,
                background: THEME.bgAlt || THEME.bg,
                color: THEME.textMain,
                border: `1px solid ${error ? THEME.danger : THEME.glassBorder}`,
                borderRadius: THEME.radiusSm,
                outline: 'none',
                transition: THEME.transitionFast,
                ...style,
            }}
        />
    </div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DataTable — lightweight themed table wrapper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface Column<T> {
    key: string;
    header: string;
    width?: string | number;
    align?: 'left' | 'center' | 'right';
    render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    emptyMessage?: string;
    onRowClick?: (row: T, index: number) => void;
    style?: React.CSSProperties;
    maxHeight?: string | number;
}

export function DataTable<T extends Record<string, any>>({
    columns, data, emptyMessage = 'No data', onRowClick, style, maxHeight,
}: DataTableProps<T>) {
    return (
        <div style={{
            border: `1px solid ${THEME.glassBorder}`,
            borderRadius: THEME.radiusMd,
            overflow: 'hidden',
            ...style,
        }}>
            <div style={{
                overflowX: 'auto',
                ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
            }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontFamily: TYPO.fonts.body,
                }}>
                    <thead>
                        <tr style={{
                            background: THEME.surfaceHover,
                            position: 'sticky', top: 0, zIndex: 1,
                        }}>
                            {columns.map(col => (
                                <th key={col.key} style={{
                                    ...TYPO.label,
                                    ...PAD.cell,
                                    textAlign: col.align || 'left',
                                    color: THEME.textMuted,
                                    borderBottom: `1px solid ${THEME.glassBorder}`,
                                    width: col.width,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} style={{
                                    ...TYPO.bodySmall,
                                    textAlign: 'center',
                                    padding: sp(8),
                                    color: THEME.textDim,
                                }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, i) => (
                                <tr
                                    key={i}
                                    onClick={() => onRowClick?.(row, i)}
                                    style={{
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        transition: THEME.transitionFast,
                                        borderBottom: `1px solid ${THEME.glassBorder}`,
                                    }}
                                >
                                    {columns.map(col => (
                                        <td key={col.key} style={{
                                            ...TYPO.bodySmall,
                                            ...PAD.cell,
                                            color: THEME.textMain,
                                            textAlign: col.align || 'left',
                                        }}>
                                            {col.render ? col.render(row, i) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
