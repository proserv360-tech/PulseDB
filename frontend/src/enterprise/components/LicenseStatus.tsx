// ==========================================================================
//  FATHOM — License Status Badge Component
// ==========================================================================
//  Small status badge showing current license tier, expiry, usage stats
// ==========================================================================

import React, { useState } from 'react';
import { Badge, Calendar, Zap } from 'lucide-react';
import { useLicense } from '../context/LicenseContext';
import { THEME } from '../../utils/theme';

const LicenseStatus = ({ showDetails = false }) => {
    const { tier, license, loading } = useLicense();
    const [isHovered, setIsHovered] = useState(false);

    if (loading) {
        return (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                backgroundColor: 'T.surfaceHover',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'T.textMuted',
            }}>
                <span style={{ animation: 'spin 0.6s linear infinite' }}>⟳</span>
                Loading...
            </div>
        );
    }

    const tierConfig = {
        community: {
            label: 'Community',
            color: THEME.textDim,
            bgColor: 'rgba(100,104,139,0.1)',
            icon: '◇',
        },
        pro: {
            label: 'Pro',
            color: 'T.primary',
            bgColor: 'rgba(99,102,241,0.1)',
            icon: '◆',
        },
        enterprise: {
            label: 'Enterprise',
            color: THEME.primaryLight,
            bgColor: 'rgba(167,139,250,0.1)',
            icon: '◈',
        },
    };

    const config = tierConfig[tier] || tierConfig.community;

    const badgeStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '14px 20px',
        backgroundColor: config.bgColor,
        border: `1px solid T.glassBorder`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(12px)',
    };

    const badgeHoverStyle = {
        ...badgeStyle,
        backgroundColor: config.bgColor,
        boxShadow: `0 0 12px ${config.color}30`,
    };

    const contentStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        fontWeight: '600',
        color: config.color,
    };

    const tooltipStyle = {
        position: 'absolute',
        bottom: '-120px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'T.surface',
        border: `1px solid T.glassBorder`,
        borderRadius: '12px',
        padding: '22px 28px',
        minWidth: '180px',
        fontSize: '11px',
        color: 'T.textMuted',
        zIndex: 1000,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(12px)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
    };

    const handleClick = () => {
        window.location.href = '/#/admin/license';
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

    return (
        <div
            style={isHovered ? badgeHoverStyle : badgeStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            title="Click to view license details"
        >
            <div style={contentStyle}>
                <span>{config.icon}</span>
                {config.label}
            </div>

            {isHovered && showDetails && (
                <div style={tooltipStyle}>
                    <div style={{ marginBottom: '6px', fontWeight: '600', color: THEME.textMain }}>
                        License Details
                    </div>
                    {license?.expiresAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Calendar size={10} />
                            <span>Expires: {formatDate(license.expiresAt)}</span>
                        </div>
                    )}
                    {license?.connectionsUsed !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            <Zap size={10} />
                            <span>Connections: {license.connectionsUsed} used</span>
                        </div>
                    )}
                    {license?.usersCount !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Users: {license.usersCount}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LicenseStatus;