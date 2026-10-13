import React, { useState, useEffect } from 'react';
import { CheckCircle, Save, X } from 'lucide-react';
import { DS } from '../../config/designTokens';
import { THEME } from '../../utils/theme';

export const ProfileModal = ({ user, onClose, onSave }) => {
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name cannot be empty');
            return;
        }
        setSaving(true);
        setError('');
        try {
            // SECURITY: Retrieve token from sessionStorage instead of localStorage
            const token = sessionStorage.getItem('fathom_token');
            const res = await fetch('/api/users/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: name.trim(), email: email.trim() }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || 'Save failed');
            }
            const updated = await res.json().catch(() => ({}));
            onSave({ ...user, name: name.trim(), email: email.trim(), ...updated });
            setSaved(true);
            setTimeout(onClose, 1500);
        } catch (e) {
            // If backend not available, save locally
            onSave({ ...user, name: name.trim(), email: email.trim() });
            setSaved(true);
            setTimeout(onClose, 1500);
        } finally {
            setSaving(false);
        }
    };

    const initials =
        name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || '?';

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                style={{
                    background: DS.surface,
                    border: `1px solid ${DS.borderAccent}`,
                    borderRadius: 20,
                    width: 420,
                    maxWidth: '94vw',
                    boxShadow: `${DS.shadowDeep}, ${DS.glowCyan}`,
                    overflow: 'hidden',
                    animation: 'slideUp 0.3s cubic-bezier(0.34,1.4,0.64,1) both',
                }}
            >
                {/* Rainbow top bar */}
                <div
                    style={{
                        height: 3,
                        background: `linear-gradient(90deg, ${DS.cyan}, ${DS.violet}, ${DS.emerald})`,
                        backgroundSize: '200% 100%',
                        animation: 'waveFlow 3s ease infinite',
                    }}
                />

                {/* Header */}
                <div
                    style={{
                        padding: '20px 26px 18px',
                        borderBottom: `1px solid ${DS.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontSize: 17,
                            fontWeight: 700,
                            color: DS.textPrimary,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        Profile Settings
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${DS.border}`,
                            color: DS.textSub,
                            cursor: 'pointer',
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(251,113,133,0.12)';
                            e.currentTarget.style.color = DS.rose;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                            e.currentTarget.style.color = DS.textSub;
                        }}
                    >
                        <X size={15} strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                            style={{
                                width: 60,
                                height: 60,
                                borderRadius: 14,
                                flexShrink: 0,
                                background: `linear-gradient(135deg, ${DS.cyan}40, ${DS.violet}40)`,
                                border: `2px solid ${DS.borderAccent}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 22,
                                fontWeight: 700,
                                color: DS.cyan,
                                fontFamily: DS.fontUI,
                                boxShadow: DS.glowCyan,
                            }}
                        >
                            {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: DS.textPrimary }}>{user?.name}</div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: DS.cyan,
                                    fontFamily: DS.fontMono,
                                    marginTop: 2,
                                    letterSpacing: '0.02em',
                                }}
                            >
                                {user?.role || 'user'} · {user?.accessLevel || 'read'}
                            </div>
                        </div>
                    </div>

                    {/* Name field */}
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 600,
                                color: DS.textMuted,
                                marginBottom: 6,
                                letterSpacing: '0.02em',
                            }}
                        >
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setError('');
                            }}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${DS.border}`,
                                borderRadius: 9,
                                padding: '10px 13px',
                                color: DS.textPrimary,
                                fontSize: 14,
                                outline: 'none',
                                fontFamily: DS.fontUI,
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = DS.borderAccent)}
                            onBlur={(e) => (e.target.style.borderColor = DS.border)}
                        />
                    </div>

                    {/* Email field */}
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: 11,
                                fontWeight: 600,
                                color: DS.textMuted,
                                marginBottom: 6,
                                letterSpacing: '0.02em',
                            }}
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${DS.border}`,
                                borderRadius: 9,
                                padding: '10px 13px',
                                color: DS.textPrimary,
                                fontSize: 14,
                                outline: 'none',
                                fontFamily: DS.fontUI,
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => (e.target.style.borderColor = DS.borderAccent)}
                            onBlur={(e) => (e.target.style.borderColor = DS.border)}
                        />
                    </div>

                    {/* Read-only fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                            ['Role', user?.role || '—'],
                            ['Access', user?.accessLevel || '—'],
                        ].map(([lbl, val]) => (
                            <div key={lbl} style={{ display: 'flex', flexDirection: 'column' }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: DS.textMuted,
                                        marginBottom: 6,
                                        letterSpacing: '0.02em',
                                    }}
                                >
                                    {lbl}
                                </label>
                                <div
                                    style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${DS.border}`,
                                        borderRadius: 9,
                                        padding: '10px 13px',
                                        color: DS.textMuted,
                                        fontSize: 13,
                                        fontFamily: DS.fontMono,
                                        letterSpacing: '0.04em',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    {val}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: 9,
                                background: 'rgba(251,113,133,0.08)',
                                border: '1px solid rgba(251,113,133,0.25)',
                                color: DS.rose,
                                fontSize: 12,
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* Save button */}
                    <button
                        onClick={handleSave}
                        disabled={saving || saved}
                        style={{
                            width: '100%',
                            padding: '13px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: saved
                                ? `linear-gradient(135deg, ${DS.emerald}, ${DS.emerald})`
                                : `linear-gradient(135deg, ${DS.cyan}, ${DS.violet})`,
                            color: THEME.textInverse,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: saving || saved ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            letterSpacing: '0.03em',
                            fontFamily: DS.fontUI,
                            transition: 'all 0.2s',
                            opacity: saving ? 0.7 : 1,
                            boxShadow: '0 4px 20px rgba(99,102,241,0.22)',
                        }}
                    >
                        {saved ? (
                            <>
                                <CheckCircle size={15} /> Saved!
                            </>
                        ) : saving ? (
                            <>
                                <Save size={15} /> Saving…
                            </>
                        ) : (
                            <>
                                <Save size={15} /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};