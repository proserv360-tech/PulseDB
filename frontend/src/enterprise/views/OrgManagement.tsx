// ==========================================================================
//  PulseDB — Organization Management View
// ==========================================================================
//  Organization management page: org details, member list, invite form
// ==========================================================================

import React, { useState } from 'react';
import { Users, UserPlus, Mail, Trash2, Shield, RefreshCw, Check, X } from 'lucide-react';
import { useOrg } from '../context/OrgContext';
import { postData, deleteData, patchData } from '../../utils/api';
import { THEME } from '../../utils/theme';

const ROLE_CONFIG = {
    owner: { label: 'Owner', color: THEME.primaryLight },
    admin: { label: 'Admin', color: THEME.primary },
    member: { label: 'Member', color: THEME.textMuted },
    viewer: { label: 'Viewer', color: THEME.textDim },
};

const OrgManagement = () => {
    const { currentOrg, members, refreshOrgs } = useOrg();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('member');
    const [inviting, setInviting] = useState(false);
    const [message, setMessage] = useState(null);
    const [loadingMemberOps, setLoadingMemberOps] = useState({});

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            setMessage({ type: 'error', text: 'Please enter an email address' });
            return;
        }

        setInviting(true);
        try {
            await postData(`/api/organizations/${currentOrg.id}/invite`, {
                email: email.trim(),
                role,
            });
            setMessage({ type: 'success', text: 'Invitation sent successfully!' });
            setEmail('');
            await refreshOrgs();
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to send invitation' });
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;

        setLoadingMemberOps({ ...loadingMemberOps, [memberId]: 'remove' });
        try {
            await deleteData(`/api/organizations/${currentOrg.id}/members/${memberId}`);
            setMessage({ type: 'success', text: 'Member removed successfully' });
            await refreshOrgs();
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to remove member' });
        } finally {
            setLoadingMemberOps({ ...loadingMemberOps, [memberId]: null });
        }
    };

    const handleChangeRole = async (memberId, newRole) => {
        setLoadingMemberOps({ ...loadingMemberOps, [memberId]: 'role' });
        try {
            await patchData(`/api/organizations/${currentOrg.id}/members/${memberId}`, {
                role: newRole,
            });
            setMessage({ type: 'success', text: 'Role updated successfully' });
            await refreshOrgs();
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to update role' });
        } finally {
            setLoadingMemberOps({ ...loadingMemberOps, [memberId]: null });
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Never';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = now - date;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            if (days === 0) return 'Today';
            if (days === 1) return 'Yesterday';
            if (days < 7) return `${days} days ago`;
            if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const styles = {
        container: {
            padding: '20px',
            backgroundColor: 'T.bg',
            minHeight: '100vh',
            color: 'T.textMain',
            fontFamily: "'Outfit', sans-serif",
        },
        header: {
            marginBottom: '30px',
        },
        title: {
            fontSize: '24px',
            fontWeight: '700',
            margin: '0 0 8px 0',
            color: 'T.textMain',
        },
        subtitle: {
            fontSize: '14px',
            color: 'T.textMuted',
            margin: '0',
        },
        section: {
            marginBottom: '30px',
            padding: '20px',
            backgroundColor: 'T.surfaceHover',
            border: '1px solid T.glassBorder',
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.2s ease',
        },
        sectionTitle: {
            fontSize: '16px',
            fontWeight: '700',
            margin: '0 0 20px 0',
            color: 'T.textMain',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        },
        orgDetails: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
        },
        detail: {
            padding: '16px',
            backgroundColor: 'T.surfaceRaised',
            border: '1px solid T.glassBorder',
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
            transition: 'all 0.2s ease',
        },
        label: {
            fontSize: '12px',
            color: 'T.textMuted',
            fontWeight: '600',

            margin: '0 0 4px 0',
        },
        value: {
            fontSize: '14px',
            fontWeight: '600',
            color: 'T.primary',
            margin: '0',
        },
        form: {
            display: 'grid',
            gap: '20px',
            maxWidth: '600px',
        },
        formRow: {
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '20px',
            alignItems: 'flex-end',
        },
        input: {
            padding: '18px 22px',
            backgroundColor: 'T.surfaceHover',
            border: '1px solid T.glassBorder',
            borderRadius: '16px',
            color: 'T.textMain',
            fontSize: '13px',
            width: '100%',
            boxSizing: 'border-box',
        },
        select: {
            padding: '18px 22px',
            backgroundColor: 'T.surfaceHover',
            border: '1px solid T.glassBorder',
            borderRadius: '16px',
            color: 'T.textMain',
            fontSize: '13px',
        },
        button: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px 22px',
            backgroundColor: 'T.primary',
            color: '#fff',
            border: 'none',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
        },
        buttonSmall: {
            padding: '6px 10px',
            fontSize: '12px',
            minWidth: 'auto',
        },
        buttonDanger: {
            backgroundColor: 'T.danger',
        },
        message: {
            padding: '20px 24px',
            borderRadius: '16px',
            fontSize: '13px',
            marginBottom: '12px',
        },
        messageSuccess: {
            backgroundColor: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: 'T.success',
        },
        messageError: {
            backgroundColor: 'rgba(220,38,38,0.1)',
            border: '1px solid rgba(220,38,38,0.3)',
            color: 'T.danger',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
        },
        th: {
            padding: '14px 20px',
            textAlign: 'left',
            fontWeight: '700',
            color: 'T.textMuted',
            borderBottom: '1px solid T.glassBorder',
            backgroundColor: 'rgba(0,0,0,0.06)',
        },
        td: {
            padding: '12px',
            borderBottom: '1px solid T.glassBorder',
        },
        roleBadge: {
            display: 'inline-block',
            padding: '4px 8px',
            backgroundColor: 'T.surfaceHover',
            border: '1px solid T.glassBorder',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '600',
        },
        actions: {
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
        },
    };

    if (!currentOrg) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Organization Management</h1>
                </div>
                <div style={styles.section}>
                    <p style={{ color: THEME.textMuted, fontSize: '13px' }}>
                        No organization selected. Please create one first.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Organization Management</h1>
                <p style={styles.subtitle}>{currentOrg.name}</p>
            </div>

            {/* Organization Details */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    <Shield size={18} /> Organization Details
                </h2>

                <div style={styles.orgDetails}>
                    <div style={styles.detail}>
                        <p style={styles.label}>Organization Name</p>
                        <p style={styles.value}>{currentOrg.name}</p>
                    </div>
                    <div style={styles.detail}>
                        <p style={styles.label}>Slug</p>
                        <p style={styles.value}>{currentOrg.slug}</p>
                    </div>
                    <div style={styles.detail}>
                        <p style={styles.label}>Members</p>
                        <p style={styles.value}>{members.length}</p>
                    </div>
                    <div style={styles.detail}>
                        <p style={styles.label}>Created</p>
                        <p style={styles.value}>{formatDate(currentOrg.createdAt)}</p>
                    </div>
                </div>
            </div>

            {/* Invite Member */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    <UserPlus size={18} /> Invite Member
                </h2>

                {message && (
                    <div style={{
                        ...styles.message,
                        ...(message.type === 'success' ? styles.messageSuccess : styles.messageError),
                    }}>
                        {message.text}
                    </div>
                )}

                <form style={styles.form} onSubmit={handleInvite}>
                    <div style={styles.formRow}>
                        <input
                            style={styles.input}
                            type="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <select
                            style={styles.select}
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            <option value="viewer">Viewer</option>
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button
                            style={styles.button}
                            type="submit"
                            disabled={inviting}
                        >
                            {inviting ? (
                                <>
                                    <RefreshCw size={16} style={{ animation: 'spin 0.6s linear infinite' }} />
                                    Inviting...
                                </>
                            ) : (
                                <>
                                    <Mail size={16} />
                                    Invite
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Members List */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    <Users size={18} /> Members ({members.length})
                </h2>

                {members.length === 0 ? (
                    <p style={{ color: THEME.textMuted, fontSize: '13px', margin: 0 }}>
                        No members yet. Invite someone to get started.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Name</th>
                                    <th style={styles.th}>Email</th>
                                    <th style={styles.th}>Role</th>
                                    <th style={styles.th}>Last Active</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((member) => (
                                    <tr key={member.id}>
                                        <td style={styles.td}>
                                            {member.name || 'Unnamed User'}
                                        </td>
                                        <td style={styles.td}>
                                            {member.email}
                                        </td>
                                        <td style={styles.td}>
                                            <select
                                                style={{
                                                    ...styles.roleBadge,
                                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${ROLE_CONFIG[member.role]?.color || THEME.textMuted}40`,
                                                    color: ROLE_CONFIG[member.role]?.color || THEME.textMuted,
                                                    cursor: member.role === 'owner' ? 'default' : 'pointer',
                                                    fontWeight: '600',
                                                    padding: '4px 6px',
                                                }}
                                                value={member.role}
                                                onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                                disabled={member.role === 'owner' || loadingMemberOps[member.id]}
                                            >
                                                <option value="viewer">Viewer</option>
                                                <option value="member">Member</option>
                                                <option value="admin">Admin</option>
                                                <option value="owner">Owner</option>
                                            </select>
                                        </td>
                                        <td style={styles.td}>
                                            {formatDate(member.lastActiveAt)}
                                        </td>
                                        <td style={styles.td}>
                                            <div style={styles.actions}>
                                                {member.role !== 'owner' && (
                                                    <button
                                                        style={{
                                                            ...styles.button,
                                                            ...styles.buttonSmall,
                                                            ...styles.buttonDanger,
                                                        }}
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        disabled={loadingMemberOps[member.id]}
                                                        title="Remove member"
                                                    >
                                                        {loadingMemberOps[member.id] === 'remove' ? (
                                                            <RefreshCw size={14} style={{ animation: 'spin 0.6s linear infinite' }} />
                                                        ) : (
                                                            <Trash2 size={14} />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrgManagement;