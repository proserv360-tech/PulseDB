/**
 * Application Constants
 * Single source of truth for roles, permissions, and fixed dataset values.
 */

import { T } from './theme';

// ─── User Roles & Badge Configurations ─────────────────────────────────────────
export const ROLES = [
    { id: 'super_admin', label: 'Super Admin', color: T.danger,  badge: '👑', perms: 'All' },
    { id: 'admin',       label: 'Admin',       color: T.warning, badge: '🛠️', perms: 'Most' },
    { id: 'editor',      label: 'Editor',      color: T.primary, badge: '📝', perms: 'Some' },
    { id: 'viewer',      label: 'Viewer',      color: T.success, badge: '👁️', perms: 'Read-only' },
    { id: 'guest',       label: 'Guest',       color: T.textDim, badge: '👤', perms: 'Minimal' }
];

// ─── Form Dropdown Options ────────────────────────────────────────────────────
export const DEPARTMENTS = [
    'Engineering', 'Product', 'Design', 'Marketing',
    'Sales', 'HR', 'Finance', 'Operations'
];

export const LOCATIONS = [
    'Coimbatore', 'Hyderabad'
];

// ─── Permission Matrix Configuration ──────────────────────────────────────────
export const RESOURCE_ROWS = ['users', 'roles', 'billing', 'settings', 'reports', 'integrations'];

export const PERM_LABELS = {
    r: 'Read',
    w: 'Write',
    d: 'Delete',
    a: 'Admin'
};

export const PERM_COLORS = {
    r: T.success,
    w: T.warning,
    d: T.danger,
    a: T.accent
};

// Default permissions mapped to each role
export const DEFAULT_PERMISSIONS = {
    super_admin: {
        users: ['r','w','d','a'], roles: ['r','w','d','a'], billing: ['r','w','d','a'],
        settings: ['r','w','d','a'], reports: ['r','w','d','a'], integrations: ['r','w','d','a']
    },
    admin: {
        users: ['r','w'], roles: ['r','w'], billing: ['r'],
        settings: ['r','w'], reports: ['r','w'], integrations: ['r','w']
    },
    editor: {
        users: ['r'], roles: ['r'], billing: [],
        settings: [], reports: ['r','w'], integrations: []
    },
    viewer: {
        users: ['r'], roles: ['r'], billing: [],
        settings: [], reports: ['r'], integrations: []
    },
    guest: {
        users: [], roles: [], billing: [],
        settings: [], reports: [], integrations: []
    }
};

// ─── Audit & Security Log Colors ──────────────────────────────────────────────
export const AUDIT_LEVELS = {
    info: T.primary,
    warn: T.warning,
    critical: T.danger,
    success: T.success
};

export const SESSION_RISK_COLORS = {
    low: T.success,
    high: T.warning,
    critical: T.danger
};