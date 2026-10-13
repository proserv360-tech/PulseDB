// @ts-nocheck
import React, { useState, useEffect, FC } from 'react';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { fetchData, putData, postData } from '../../../utils/api';
import {
    User, Mail, Lock, Palette, Bell, Clock, LogOut, Save, AlertTriangle,
    Eye, EyeOff, RefreshCw, CheckCircle, Activity, Shield
} from 'lucide-react';

/* ── TYPE DEFINITIONS ───────────────────────────────────────────────────── */
interface UserProfile {
    id: number;
    email: string;
    fullName: string;
    role: string;
    avatar?: string;
    lastLogin?: string;
    createdAt?: string;
    preferences?: {
        theme?: string;
        refreshInterval?: number;
        emailNotifications?: boolean;
        slackNotifications?: boolean;
    };
}

interface ActivityLog {
    id: number;
    action: string;
    description: string;
    timestamp: string;
    ipAddress?: string;
}

/* ── STYLES ───────────────────────────────────────────────────────────────── */
const Styles: FC = () => (
    <style>{`
        @keyframes upFade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes upSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .up-card { background:${THEME.surface}; border:1px solid ${THEME.glassBorder}; border-radius: 20px; padding:20px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04); animation:upFade .3s ease; transition:all 0.2s ease; backdrop-filter:blur(12px); }
        .up-card:hover { border-color:${THEME.primary}30; transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06); }
        .up-card-section { padding:14px 20px; border-bottom:1px solid ${THEME.glassBorder}; background:${THEME.bg}06; }
        .up-card-section:last-child { border-bottom:none; }
        .up-card-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:${THEME.textMuted}; margin-bottom:12px; }
        .up-label { font-size:12px; font-weight:700; color:${THEME.textMuted}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
        .up-input { background:${THEME.surfaceHover}; border:1px solid ${THEME.glassBorder}; border-radius: 22px; padding:12px 14px; color:${THEME.textMain}; font-size:13px; width:100%; }
        .up-input:focus { outline:none; border-color:${THEME.primary}; }
        .up-button { background:${THEME.primary}; color:${THEME.textInverse}; border:none; border-radius: 22px; padding:12px 18px; font-weight:700; font-size:13px; cursor:pointer; }
        .up-button:hover { background:${THEME.primaryLight}; }
        .up-button-secondary { background:${THEME.secondary}; }
        .up-button-secondary:hover { background:${THEME.primary}; }
        .up-spinner { animation:upSpin 1s linear infinite; }
        .up-avatar { width:80px; height:80px; border-radius:50%; background:${THEME.primary}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:24px; color:${THEME.textInverse}; }
        .up-toggle { display:flex; align-items:center; gap: 22px; padding:10px 0; }
        .up-toggle-switch { width:40px; height:24px; background:${THEME.glassBorder}; border-radius: 22px; position:relative; cursor:pointer; }
        .up-toggle-switch.on { background:${THEME.success}; }
        .up-toggle-switch span { width:20px; height:20px; background:white; border-radius:50%; position:absolute; top:2px; left:2px; transition:left 0.2s; }
        .up-toggle-switch.on span { left:18px; }
        .up-row { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
        .up-activity-item { background:${THEME.surfaceHover}; border-left:3px solid ${THEME.primary}; border-radius: 22px; padding:14px 18px; margin-bottom:12px; }
        .up-activity-time { font-size:11px; color:${THEME.textMuted}; text-transform:uppercase; }
        .up-activity-action { font-weight:600; color:${THEME.textMain}; margin:4px 0; }
        .up-activity-desc { font-size:12px; color:${THEME.textMuted}; }
    `}</style>
);

const UserProfileTab: FC = () => {
    useAdaptiveTheme();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
    const [theme, setTheme] = useState('dark');
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [slackNotifications, setSlackNotifications] = useState(false);

    const [showPasswordForm, setShowPasswordForm] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [p, a] = await Promise.all([
                    fetchData('/api/user/profile'),
                    fetchData('/api/user/activity-log?limit=10'),
                ]);
                setProfile(p);
                setActivityLog(a?.activities || []);

                // Initialize form values
                setDisplayName(p?.fullName || '');
                setEmail(p?.email || '');
                setTheme(p?.preferences?.theme || 'dark');
                setRefreshInterval(p?.preferences?.refreshInterval || 30);
                setEmailNotifications(p?.preferences?.emailNotifications !== false);
                setSlackNotifications(p?.preferences?.slackNotifications || false);

                setError(null);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await putData('/api/user/profile', {
                fullName: displayName,
                email: email,
            });
            setSuccess('Profile updated successfully');
            setError(null);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('All password fields are required');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setSaving(true);
        try {
            await postData('/api/user/change-password', {
                currentPassword,
                newPassword,
            });
            setSuccess('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordForm(false);
            setError(null);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleSavePreferences = async () => {
        setSaving(true);
        try {
            await putData('/api/user/preferences', {
                theme,
                refreshInterval: Number(refreshInterval),
                emailNotifications,
                slackNotifications,
            });
            setSuccess('Preferences saved successfully');
            setError(null);
            setTimeout(() => setSuccess(null), 3000);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Styles />
                <RefreshCw size={32} color={THEME.primary} className="up-spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: THEME.textMuted }}>Loading profile...</div>
            </div>
        );
    }

    const initials = (profile?.fullName || '').split(' ').map(n => n[0]).join('').toUpperCase();
    const lastLoginTime = profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : 'Never';

    return (
        <div style={{ padding: '20px', maxWidth: '1000px' }}>
            <Styles />

            {error && (
                <div style={{
                    background: `${THEME.danger}15`,
                    border: `1px solid ${THEME.danger}40`,
                    borderRadius: 16,
                    padding: '18px 22px',
                    marginBottom: 20,
                    color: THEME.danger,
                    fontSize: 13
                }}>
                    <AlertTriangle size={16} style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                    {error}
                </div>
            )}

            {success && (
                <div style={{
                    background: `${THEME.success}15`,
                    border: `1px solid ${THEME.success}40`,
                    borderRadius: 16,
                    padding: '18px 22px',
                    marginBottom: 20,
                    color: THEME.success,
                    fontSize: 13
                }}>
                    {success}
                </div>
            )}

            {/* Profile Header */}
            <div className="up-card" style={{ marginBottom: 20, textAlign: 'center' }}>
                <div className="up-avatar" style={{ margin: '0 auto 16px' }}>
                    {initials}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: THEME.textMain, marginBottom: 4 }}>
                    {profile?.fullName}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ background: THEME.primary, color: THEME.textInverse, padding: '4px 10px', borderRadius: 18, fontSize: 11, fontWeight: 700 }}>
                        {profile?.role || 'User'}
                    </div>
                    <div style={{ color: THEME.textMuted, fontSize: 12 }}>
                        {profile?.email}
                    </div>
                </div>
                <div style={{ color: THEME.textMuted, fontSize: 12, display: 'flex', justifyContent: 'center', gap: 20, alignItems: 'center' }}>
                    <Clock size={12} />
                    Last login: {lastLoginTime}
                </div>
            </div>

            {/* Account Settings */}
            <div className="up-card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 20 }}>
                    <User size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                    Account Settings
                </div>

                <div className="up-row">
                    <div>
                        <div className="up-label">Display Name</div>
                        <input
                            type="text"
                            className="up-input"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>
                    <div>
                        <div className="up-label">Email</div>
                        <input
                            type="email"
                            className="up-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <button className="up-button" onClick={handleSaveProfile} disabled={saving} style={{ marginBottom: 16 }}>
                    {saving ? <RefreshCw size={14} className="up-spinner" style={{ marginRight: 6, display: 'inline' }} /> : <Save size={14} style={{ marginRight: 6, display: 'inline' }} />}
                    {saving ? 'Saving...' : 'Save Account Changes'}
                </button>

                {/* Password Change Section */}
                {!showPasswordForm ? (
                    <button
                        className="up-button up-button-secondary"
                        onClick={() => setShowPasswordForm(true)}
                    >
                        <Lock size={14} style={{ marginRight: 6, display: 'inline' }} />
                        Change Password
                    </button>
                ) : (
                    <div style={{ background: THEME.surfaceHover, borderRadius: 20, padding: 16, marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.textMain, marginBottom: 16 }}>
                            Change Password
                        </div>

                        <div className="up-row" style={{ marginBottom: 16 }}>
                            <div>
                                <div className="up-label">Current Password</div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPasswords.current ? 'text' : 'password'}
                                        className="up-input"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                    />
                                    <button
                                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                        style={{
                                            position: 'absolute',
                                            right: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: THEME.textMuted,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="up-row" style={{ marginBottom: 16 }}>
                            <div>
                                <div className="up-label">New Password</div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPasswords.new ? 'text' : 'password'}
                                        className="up-input"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                    <button
                                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                        style={{
                                            position: 'absolute',
                                            right: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: THEME.textMuted,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <div className="up-label">Confirm Password</div>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        className="up-input"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    <button
                                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                        style={{
                                            position: 'absolute',
                                            right: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: THEME.textMuted,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 22 }}>
                            <button className="up-button" onClick={handleChangePassword} disabled={saving}>
                                {saving ? <RefreshCw size={14} className="up-spinner" style={{ marginRight: 6, display: 'inline' }} /> : <Lock size={14} style={{ marginRight: 6, display: 'inline' }} />}
                                {saving ? 'Updating...' : 'Update Password'}
                            </button>
                            <button
                                className="up-button up-button-secondary"
                                onClick={() => setShowPasswordForm(false)}
                                style={{ background: THEME.surfaceHover }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Preferences */}
            <div className="up-card" style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 20 }}>
                    <Palette size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                    Preferences
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div className="up-label">Theme Preference</div>
                    <select
                        className="up-input"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        style={{ cursor: 'pointer' }}
                    >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="auto">Auto</option>
                    </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div className="up-label">Default Refresh Interval (seconds)</div>
                    <input
                        type="number"
                        className="up-input"
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        min="5"
                        max="300"
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div className="up-label">Notification Preferences</div>
                    <div className="up-toggle">
                        <span style={{ flex: 1, color: THEME.textMain }}>Email Notifications</span>
                        <div
                            className={`up-toggle-switch ${emailNotifications ? 'on' : ''}`}
                            onClick={() => setEmailNotifications(!emailNotifications)}
                        >
                            <span />
                        </div>
                    </div>
                    <div className="up-toggle">
                        <span style={{ flex: 1, color: THEME.textMain }}>Slack Notifications</span>
                        <div
                            className={`up-toggle-switch ${slackNotifications ? 'on' : ''}`}
                            onClick={() => setSlackNotifications(!slackNotifications)}
                        >
                            <span />
                        </div>
                    </div>
                </div>

                <button className="up-button" onClick={handleSavePreferences} disabled={saving}>
                    {saving ? <RefreshCw size={14} className="up-spinner" style={{ marginRight: 6, display: 'inline' }} /> : <Save size={14} style={{ marginRight: 6, display: 'inline' }} />}
                    {saving ? 'Saving...' : 'Save Preferences'}
                </button>
            </div>

            {/* Activity Log */}
            <div className="up-card">
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.textMain, marginBottom: 20 }}>
                    <Activity size={18} style={{ display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />
                    Recent Activity
                </div>

                {activityLog.length === 0 ? (
                    <div style={{ color: THEME.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
                        No recent activity
                    </div>
                ) : (
                    <div>
                        {activityLog.map((activity, idx) => (
                            <div key={idx} className="up-activity-item">
                                <div className="up-activity-time">
                                    {new Date(activity.timestamp).toLocaleString()}
                                </div>
                                <div className="up-activity-action">
                                    {activity.action}
                                </div>
                                <div className="up-activity-desc">
                                    {activity.description}
                                </div>
                                {activity.ipAddress && (
                                    <div className="up-activity-desc">
                                        IP: {activity.ipAddress}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfileTab;