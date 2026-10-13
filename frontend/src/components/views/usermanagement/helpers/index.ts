/**
 * Utility functions — pure helpers with no side-effects.
 * Keep all business-logic-free helpers here.
 */

/**
 * Returns a human-readable relative time string.
 * @param {string} iso - ISO 8601 date string
 * @returns {string}
 */
export function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

/**
 * Validate a user form object.
 * @param {{ name: string, email: string, username?: string, password?: string }} form
 * @param {boolean} isEdit - skip username/password checks when editing an existing user
 * @returns {{ [field: string]: string }} — empty object means valid
 */
export function validateUserForm(form, isEdit = false) {
    const errors = {};
    if (!form.name?.trim() || form.name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Valid email required';
    }
    if (!isEdit) {
        if (!form.username?.trim() || form.username.trim().length < 3) {
            errors.username = 'Username must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9._-]+$/.test(form.username.trim())) {
            errors.username = 'Username may only contain letters, numbers, dots, underscores, or hyphens';
        }
        if (!form.password || form.password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        }
    }
    return errors;
}

/**
 * Generate a cryptographically-safe random password.
 * Uses window.crypto.getRandomValues when available; falls back to Math.random.
 * @param {number} length
 * @returns {string}
 */
export function generatePassword(length = 14) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    const bytes = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, b => charset[b % charset.length]).join('');
}

/**
 * Evaluate the strength of a password.
 * @param {string} pw
 * @returns {{ label: 'Strong'|'Medium'|'Weak', color: string }}
 */
export function passwordStrength(pw, colors) {
    const strong = pw.length >= 12 && /[!@#$%^&*]/.test(pw) && /[0-9]/.test(pw) && /[A-Z]/.test(pw);
    const medium = pw.length >= 8;
    if (strong) return { label: 'Strong', color: colors.success };
    if (medium)  return { label: 'Medium', color: colors.warning };
    return { label: 'Weak', color: colors.danger };
}

/**
 * Compute a risk score from raw user data.
 * Centralised here so the formula stays consistent across the UI and tests.
 * @param {{ failedLogins: number, lastLogin: string }} user
 * @returns {number} 0–100
 */
export function computeRiskScore({ failedLogins = 0, lastLogin }) {
    const daysSinceLogin = (Date.now() - new Date(lastLogin).getTime()) / 86_400_000;
    return Math.min(100,
        failedLogins * 7 +
        (daysSinceLogin > 14 ? 20 : 0) +
        Math.floor(Math.random() * 20)  // In prod: replace with a real signal
    );
}

/**
 * Safely copy text to clipboard; returns a promise.
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers / non-HTTPS
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
}