// ==========================================================================
//  FATHOM — Organization Switcher Component
// ==========================================================================
//  Organization selector dropdown for multi-tenant users
//  Shows current org name with a dropdown to switch
// ==========================================================================

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { useOrg } from '../context/OrgContext';

const OrgSwitcher = () => {
    const { currentOrg, organizations, switchOrg } = useOrg();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Hide dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Only show if user has multiple orgs
    if (organizations.length <= 1) {
        return null;
    }

    const handleSwitchOrg = (orgId) => {
        switchOrg(orgId);
        setIsOpen(false);
    };

    const styles = {
        container: {
            position: 'relative',
            display: 'inline-block',
            width: '100%',
        },
        button: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '18px 22px',
            backgroundColor: 'T.surfaceHover',
            border: '1px solid T.glassBorder',
            borderRadius: '12px',
            color: 'T.textMain',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            width: '100%',
            boxSizing: 'border-box',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
        },
        buttonHover: {
            backgroundColor: 'T.surface',
            borderColor: 'T.primary',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        },
        dropdown: {
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            backgroundColor: 'T.surface',
            border: '1px solid T.glassBorder',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
            zIndex: 1000,
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
        },
        orgItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '22px 28px',
            color: 'T.textMuted',
            fontSize: '13px',
            cursor: 'pointer',
            borderBottom: '1px solid T.glassBorder',
            transition: 'all 0.15s ease',
        },
        orgItemHover: {
            backgroundColor: 'T.surfaceHover',
            color: 'T.textMain',
        },
        orgItemActive: {
            backgroundColor: 'rgba(0,0,0,0.06)',
            color: 'T.primary',
            fontWeight: '600',
        },
        avatar: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            backgroundColor: 'T.surfaceRaised',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: '600',
            flexShrink: 0,
            boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
            backdropFilter: 'blur(8px)',
        },
        orgInfo: {
            flex: 1,
            minWidth: 0,
        },
        orgName: {
            fontSize: '13px',
            fontWeight: '500',
            margin: '0 0 2px 0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
        memberCount: {
            fontSize: '11px',
            opacity: '0.7',
            margin: '0',
        },
    };

    const getOrgInitials = (org) => {
        if (!org?.name) return '?';
        return org.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    const [buttonHover, setButtonHover] = useState(false);

    return (
        <div style={styles.container} ref={dropdownRef}>
            <button
                style={{
                    ...styles.button,
                    ...(buttonHover ? styles.buttonHover : {}),
                }}
                onMouseEnter={() => setButtonHover(true)}
                onMouseLeave={() => setButtonHover(false)}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <Users size={16} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {currentOrg?.name || 'Select Organization'}
                    </span>
                </div>
                <ChevronDown
                    size={16}
                    style={{
                        transition: 'transform 0.2s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                    }}
                />
            </button>

            {isOpen && (
                <div style={styles.dropdown}>
                    {organizations.map((org) => {
                        const [itemHover, setItemHover] = React.useState(false);
                        const isActive = currentOrg?.id === org.id;
                        return (
                            <div
                                key={org.id}
                                style={{
                                    ...styles.orgItem,
                                    ...(isActive ? styles.orgItemActive : itemHover ? styles.orgItemHover : {}),
                                }}
                                onMouseEnter={() => setItemHover(true)}
                                onMouseLeave={() => setItemHover(false)}
                                onClick={() => handleSwitchOrg(org.id)}
                            >
                                <div style={styles.avatar}>
                                    {getOrgInitials(org)}
                                </div>
                                <div style={styles.orgInfo}>
                                    <p style={styles.orgName}>{org.name}</p>
                                    <p style={styles.memberCount}>
                                        {org.memberCount || 0} members
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OrgSwitcher;