import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Lock, Loader, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';
import { THEME } from '../../utils/theme';

/* ═══════════════════════════════════════════════════════════════════════════
   FORCE PASSWORD CHANGE MODAL
   ─────────────────────────────────────────────────────────────────────────
   Shown immediately after login when `mustChangePassword` is true.
   Requires the user to set a new password before accessing the dashboard.
   Uses the same glass-morphism style as LoginPage's forgot-password modal.
   ═══════════════════════════════════════════════════════════════════════════ */

interface ForcePasswordChangeModalProps {
    onSuccess: () => void;
    onLogout: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({ onSuccess, onLogout }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Password strength checks
    const hasMinLength = newPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
    const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch && currentPassword.length > 0;

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('fathom_token');
            const res = await fetch(`${API_BASE}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to change password');
                setLoading(false);
                return;
            }

            // Clear the must-change flag
            localStorage.removeItem('fathom_must_change_password');
            setSuccess(true);

            // Brief success message then proceed to dashboard
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Network error. Please try again.');
            setLoading(false);
        }
    }, [isValid, currentPassword, newPassword, onSuccess]);

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '11px 40px 11px 14px',
        borderRadius: THEME.radiusMd,
        border: `1px solid ${THEME.glassBorder}`,
        background: THEME.glass,
        color: THEME.textMain,
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'all .25s',
        boxSizing: 'border-box' as const,
    };

    const eyeStyle: React.CSSProperties = {
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: THEME.textDim,
        padding: 0,
        display: 'flex',
    };

    const checkStyle = (pass: boolean): React.CSSProperties => ({
        fontSize: 11,
        color: pass ? THEME.success : THEME.textDim,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'color .3s',
    });

    if (success) {
        return (
            <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2000,
            }}>
                <div style={{
                    background: THEME.surface,
                    borderRadius: THEME.radiusLg, padding: 32,
                    maxWidth: 400, width: '90%',
                    border: `1px solid ${THEME.glassBorder}`,
                    boxShadow: THEME.shadowLg,
                    textAlign: 'center',
                }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: `${THEME.success}12`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                    }}>
                        <ShieldCheck size={28} color={THEME.success} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>
                        Password Updated
                    </h3>
                    <p style={{ fontSize: 13, color: THEME.textMuted }}>
                        Redirecting to dashboard...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000,
        }}>
            <div style={{
                background: THEME.surface,
                borderRadius: THEME.radiusLg, padding: 32,
                maxWidth: 420, width: '90%',
                border: `1px solid ${THEME.glassBorder}`,
                boxShadow: THEME.shadowLg,
                animation: 'fadeIn .3s ease',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: `${THEME.primary}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <KeyRound size={20} color={THEME.primary} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, color: THEME.textMain, margin: 0 }}>
                            Change Your Password
                        </h3>
                        <p style={{ fontSize: 12, color: THEME.textMuted, margin: '4px 0 0' }}>
                            A password change is required to continue
                        </p>
                    </div>
                </div>

                {/* Security notice */}
                <div style={{
                    margin: '16px 0',
                    padding: '10px 14px',
                    borderRadius: THEME.radiusMd,
                    background: `${THEME.primary}0a`,
                    border: `1px solid ${THEME.primary}20`,
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <Lock size={14} color={THEME.primary} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 1.4 }}>
                        Your account requires a password update for security. Please set a new password below.
                    </span>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '10px 14px', borderRadius: THEME.radiusMd,
                        background: `${THEME.danger}0f`,
                        border: `1px solid ${THEME.danger}20`,
                        color: THEME.danger, fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 12,
                    }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Current Password */}
                    <div>
                        <label style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6, display: 'block', fontWeight: 500 }}>
                            Current Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                style={inputStyle}
                                autoFocus
                                disabled={loading}
                            />
                            <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={eyeStyle}>
                                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div>
                        <label style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6, display: 'block', fontWeight: 500 }}>
                            New Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                style={inputStyle}
                                disabled={loading}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)} style={eyeStyle}>
                                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 6, display: 'block', fontWeight: 500 }}>
                            Confirm New Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter new password"
                                style={inputStyle}
                                disabled={loading}
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeStyle}>
                                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* Password requirements */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: '4px 16px', padding: '4px 0',
                        alignItems: 'center',
                    }}>
                        <span style={checkStyle(hasMinLength)}>
                            {hasMinLength ? '✓' : '○'} Min 8 characters
                        </span>
                        <span style={checkStyle(hasUppercase)}>
                            {hasUppercase ? '✓' : '○'} Uppercase letter
                        </span>
                        <span style={checkStyle(hasLowercase)}>
                            {hasLowercase ? '✓' : '○'} Lowercase letter
                        </span>
                        <span style={checkStyle(hasNumber)}>
                            {hasNumber ? '✓' : '○'} Number
                        </span>
                        <span style={checkStyle(passwordsMatch)}>
                            {passwordsMatch ? '✓' : '○'} Passwords match
                        </span>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                            type="submit"
                            disabled={!isValid || loading}
                            style={{
                                flex: 2, padding: '12px 16px', borderRadius: THEME.radiusMd, border: 'none',
                                background: isValid && !loading
                                    ? `linear-gradient(135deg, ${THEME.primary}, ${THEME.primary})`
                                    : THEME.glass,
                                color: isValid && !loading ? THEME.textMain : THEME.textDim,
                                fontSize: 13, fontWeight: 600,
                                cursor: isValid && !loading ? 'pointer' : 'not-allowed',
                                fontFamily: 'inherit', transition: 'all .25s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                boxShadow: isValid && !loading ? `0 8px 24px ${THEME.primary}33` : 'none',
                            }}
                        >
                            {loading ? (
                                <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</>
                            ) : (
                                <><ShieldCheck size={14} /> Update Password</>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onLogout}
                            style={{
                                flex: 1, padding: '12px 16px', borderRadius: THEME.radiusMd,
                                border: `1px solid ${THEME.glassBorder}`,
                                background: 'transparent',
                                color: THEME.textMuted,
                                fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all .25s',
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForcePasswordChangeModal;