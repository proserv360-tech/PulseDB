/**
 * API Service — all HTTP calls live here.
 *
 * In development the helpers below hit the real backend.
 * Replace the base URL or swap this file for an MSW handler in tests.
 *
 * Every function returns the parsed JSON body or throws an Error
 * with a human-readable message drawn from the server response.
 */

const BASE = '/api';

/** Shared fetch wrapper with auth header and error normalisation */
async function request(path, options = {}) {
    const token = localStorage.getItem('fathom_token');
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ─── Users ───────────────────────────────────────────────────────────────────

export const UserAPI = {
    /** @returns {Promise<User[]>} */
    list: () => request('/users'),

    /** @param {Partial<User>} data */
    create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),

    /** @param {number} id @param {Partial<User>} data */
    update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    /** @param {number} id */
    remove: (id) => request(`/users/${id}`, { method: 'DELETE' }),

    /** @param {number[]} ids */
    bulkDelete: (ids) => request('/users/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),

    /** @param {number} id @param {string} newPassword */
    resetPassword: (id, newPassword) =>
        request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
};

// ─── Feedback ─────────────────────────────────────────────────────────────────

export const FeedbackAPI = {
    /** @param {object} payload */
    submit: (payload) => request('/feedback', { method: 'POST', body: JSON.stringify(payload) }),

    /** Admin: list all feedback */
    list: (params = {}) => {
        const qs = new URLSearchParams(
            Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
        ).toString();
        return request(`/admin/feedback${qs ? `?${qs}` : ''}`);
    },

    /** Admin: update status of a single feedback item */
    updateStatus: (id, status) =>
        request(`/admin/feedback/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

    summary: () => request('/admin/feedback/summary'),
};

// ─── Audit ────────────────────────────────────────────────────────────────────

export const AuditAPI = {
    /**
     * @param {{ limit?: number, level?: string }} opts
     * @returns {Promise<AuditEvent[]>}
     */
    list: (opts = {}) => {
        const qs = new URLSearchParams(Object.fromEntries(
            Object.entries(opts).filter(([, v]) => v !== undefined)
        )).toString();
        return request(`/audit${qs ? `?${qs}` : ''}`);
    },
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const SessionAPI = {
    list:      ()   => request('/sessions'),
    revoke:    (id) => request(`/sessions/${id}`, { method: 'DELETE' }),
    revokeAll: ()   => request('/sessions',       { method: 'DELETE' }),
};

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const ApiKeyService = {
    list:   ()   => request('/api-keys'),
    create: ()   => request('/api-keys',       { method: 'POST' }),
    revoke: (id) => request(`/api-keys/${id}`, { method: 'DELETE' }),
};