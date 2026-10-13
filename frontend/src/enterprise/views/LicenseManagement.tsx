// ==========================================================================
//  FATHOM — License Management View
// ==========================================================================
//  Full license management page (admin only)
//  Shows: current license details, tier comparison table, activation form
// ==========================================================================

import React, { useState } from 'react';
import { Check, X, Key, RefreshCw, Copy, ExternalLink } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { postData } from '../../utils/api';
import { THEME } from '../../utils/theme';

const LicenseManagement = () => {
    const { license, tier, refreshLicense, loading } = useLicense();
    const [licenseKey, setLicenseKey] = useState('');
    const [activating, setActivating] = useState(false);
    const [message, setMessage] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleActivate = async (e) => {
        e.preventDefault();
        if (!licenseKey.trim()) {
            setMessage({ type: 'error', text: 'Please enter a license key' });
            return;
        }

        setActivating(true);
        try {
            await postData('/api/license/activate', { licenseKey: licenseKey.trim() });
            setMessage({ type: 'success', text: 'License activated successfully!' });
            setLicenseKey('');
            await refreshLicense();
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to activate license' });
        } finally {
            setActivating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'No expiration';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Feature matrix for comparison
    const features = [
        { name: 'Basic Monitoring', cat: 'Monitoring' },
        { name: 'Alerts & Notifications', cat: 'Monitoring' },
        { name: 'Custom Dashboards', cat: 'Monitoring' },
        { name: 'Query Performance', cat: 'Monitoring' },
        { name: 'User Authentication', cat: 'Security' },
        { name: 'SAML/SSO', cat: 'Security' },
        { name: 'Audit Logs', cat: 'Security' },
        { name: 'Role-Based Access', cat: 'Security' },
        { name: 'Advanced Analytics', cat: 'Analytics' },
        { name: 'Trend Analysis', cat: 'Analytics' },
        { name: 'Capacity Planning', cat: 'Analytics' },
        { name: 'Performance Reports', cat: 'Analytics' },
        { name: 'Automated Backups', cat: 'Operations' },
        { name: 'Point-in-Time Recovery', cat: 'Operations' },
        { name: 'Maintenance Scheduling', cat: 'Operations' },
        { name: 'API Access', cat: 'Operations' },
        { name: 'Admin Console', cat: 'Administration' },
        { name: 'License Management', cat: 'Administration' },
        { name: 'Priority Support', cat: 'Administration' },
        { name: 'SLA Guarantee', cat: 'Administration' },
    ];

    const tierFeatures = {
        community: {
            'Basic Monitoring': true, 'Alerts & Notifications': true, 'Custom Dashboards': false,
            'Query Performance': true, 'User Authentication': true, 'SAML/SSO': false,
            'Audit Logs': false, 'Role-Based Access': true, 'Advanced Analytics': false,
            'Trend Analysis': false, 'Capacity Planning': false, 'Performance Reports': false,
            'Automated Backups': false, 'Point-in-Time Recovery': false, 'Maintenance Scheduling': false,
            'API Access': false, 'Admin Console': true, 'License Management': false,
            'Priority Support': false, 'SLA Guarantee': false,
        },
        pro: {
            'Basic Monitoring': true, 'Alerts & Notifications': true, 'Custom Dashboards': true,
            'Query Performance': true, 'User Authentication': true, 'SAML/SSO': true,
            'Audit Logs': true, 'Role-Based Access': true, 'Advanced Analytics': true,
            'Trend Analysis': true, 'Capacity Planning': true, 'Performance Reports': true,
            'Automated Backups': false, 'Point-in-Time Recovery': false, 'Maintenance Scheduling': false,
            'API Access': true, 'Admin Console': true, 'License Management': true,
            'Priority Support': false, 'SLA Guarantee': false,
        },
        enterprise: {
            'Basic Monitoring': true, 'Alerts & Notifications': true, 'Custom Dashboards': true,
            'Query Performance': true, 'User Authentication': true, 'SAML/SSO': true,
            'Audit Logs': true, 'Role-Based Access': true, 'Advanced Analytics': true,
            'Trend Analysis': true, 'Capacity Planning': true, 'Performance Reports': true,
            'Automated Backups': true, 'Point-in-Time Recovery': true, 'Maintenance Scheduling': true,
            'API Access': true, 'Admin Console': true, 'License Management': true,
            'Priority Support': true, 'SLA Guarantee': true,
        },
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
        currentLicense: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
        },
        licenseCard: {
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
            wordBreak: 'break-all',
        },
        form: {
            display: 'grid',
            gap: '20px',
            maxWidth: '400px',
        },
        input: {
            padding: '18px 22px',
            backgroundColor: 'T.surfaceHover',
            border: '1px solid T.glassBorder',
            borderRadius: '16px',
            color: 'T.textMain',
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', monospace",
            width: '100%',
            boxSizing: 'border-box',
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
        tierColumn: {
            fontWeight: '600',
            color: 'T.primary',
        },
        checkIcon: {
            color: 'T.success',
        },
        xIcon: {
            color: 'T.textMuted',
        },
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>License Management</h1>
                <p style={styles.subtitle}>View and manage your FATHOM license</p>
            </div>

            {/* Current License */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    Current License
                </h2>

                {loading ? (
                    <p style={{ color: THEME.textMuted, fontSize: '13px' }}>Loading license information...</p>
                ) : (
                    <div>
                        <div style={styles.currentLicense}>
                            <div style={styles.licenseCard}>
                                <p style={styles.label}>Tier</p>
                                <p style={styles.value}>
                                    {tier?.charAt(0).toUpperCase() + tier?.slice(1)}
                                </p>
                            </div>
                            <div style={styles.licenseCard}>
                                <p style={styles.label}>Status</p>
                                <p style={{ ...styles.value, color: THEME.success }}>Active</p>
                            </div>
                            <div style={styles.licenseCard}>
                                <p style={styles.label}>Expires</p>
                                <p style={styles.value}>{formatDate(license?.expiresAt)}</p>
                            </div>
                            <div style={styles.licenseCard}>
                                <p style={styles.label}>Connections</p>
                                <p style={styles.value}>{license?.connectionsUsed || 0}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Activation Form */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    <Key size={18} /> Activate New License
                </h2>

                {message && (
                    <div style={{
                        ...styles.message,
                        ...(message.type === 'success' ? styles.messageSuccess : styles.messageError),
                    }}>
                        {message.text}
                    </div>
                )}

                <form style={styles.form} onSubmit={handleActivate}>
                    <input
                        style={styles.input}
                        type="text"
                        placeholder="Enter your license key"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                    />
                    <button
                        style={styles.button}
                        type="submit"
                        disabled={activating}
                    >
                        {activating ? (
                            <>
                                <RefreshCw size={16} style={{ animation: 'spin 0.6s linear infinite' }} />
                                Activating...
                            </>
                        ) : (
                            <>
                                <Key size={16} />
                                Activate License
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Feature Comparison Table */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Feature Comparison</h2>

                <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Feature</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Community</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Pro</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Enterprise</th>
                            </tr>
                        </thead>
                        <tbody>
                            {features.map((feat, idx) => (
                                <tr key={idx}>
                                    <td style={styles.td}>{feat.name}</td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                        {tierFeatures.community[feat.name] ? (
                                            <Check size={16} style={styles.checkIcon} />
                                        ) : (
                                            <X size={16} style={styles.xIcon} />
                                        )}
                                    </td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                        {tierFeatures.pro[feat.name] ? (
                                            <Check size={16} style={styles.checkIcon} />
                                        ) : (
                                            <X size={16} style={styles.xIcon} />
                                        )}
                                    </td>
                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                        {tierFeatures.enterprise[feat.name] ? (
                                            <Check size={16} style={styles.checkIcon} />
                                        ) : (
                                            <X size={16} style={styles.xIcon} />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Support */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Need Help?</h2>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: THEME.textMuted }}>
                    Contact our support team for license questions or to purchase an upgrade.
                </p>
                <a
                    href="mailto:license@fathom.dev"
                    style={{
                        ...styles.button,
                        display: 'inline-flex',
                        textDecoration: 'none',
                    }}
                >
                    <ExternalLink size={16} />
                    Contact Support
                </a>
            </div>
        </div>
    );
};

export default LicenseManagement;