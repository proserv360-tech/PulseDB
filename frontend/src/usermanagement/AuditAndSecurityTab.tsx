import React from 'react';
import { SecurityPanel } from './PermissionMatrix/AuditAndSecurity';

/**
 * AuditAndSecurityTab.jsx
 * Wrapper component that renders the SecurityPanel for the new
 * "User Management" section's "Audit & Security" tab.
 */
export default function AuditAndSecurityTab() {
    return (
        <div style={{ padding: '20px', overflow: 'auto', height: '100%' }}>
            <SecurityPanel />
        </div>
    );
}
