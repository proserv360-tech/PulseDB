/**
 * FATHOM — Client-side Encryption Utility
 *
 * Uses the Web Crypto API (RSA-OAEP) to encrypt sensitive connection fields
 * BEFORE sending them to the backend. The backend returns its RSA public key
 * via GET /api/connections/handshake. Passwords never travel as plaintext,
 * even over HTTPS — defense in depth.
 *
 * Usage:
 *   const encryptor = new ConnectionEncryptor(API_BASE, authToken);
 *   const encrypted = await encryptor.encryptFields(formData);
 *   // encrypted.password is now RSA-OAEP ciphertext (base64)
 */

const SENSITIVE_FIELDS = ['password', 'sshPrivateKey', 'sshPassphrase', 'sshPassword'];

/**
 * Import an RSA public key (PEM) into the Web Crypto API.
 * @param {string} pem — PEM-encoded SPKI public key
 * @returns {Promise<CryptoKey>}
 */
async function importPublicKey(pem) {
    const stripped = pem
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s+/g, '');

    const binaryDer = Uint8Array.from(atob(stripped), c => c.charCodeAt(0));

    return crypto.subtle.importKey(
        'spki',
        binaryDer.buffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt'],
    );
}

/**
 * Encrypt a string with an RSA-OAEP public key.
 * @param {CryptoKey} publicKey
 * @param {string} plaintext
 * @returns {Promise<string>} base64-encoded ciphertext
 */
async function rsaEncrypt(publicKey, plaintext) {
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        encoded,
    );
    // Convert ArrayBuffer → base64
    const bytes = new Uint8Array(cipherBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/**
 * Fetches the server's RSA public key, caches it for the session.
 */
let _cachedKey = null;
let _cacheExpiry = 0;
const CACHE_TTL = 25 * 60 * 1000; // 25 min (server rotates every 30)

async function fetchPublicKey(apiBase, authToken) {
    const now = Date.now();
    if (_cachedKey && now < _cacheExpiry) return _cachedKey;

    const res = await fetch(`${apiBase}/api/connections/handshake`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`Handshake failed (${res.status})`);
    const { publicKey: pem } = await res.json();
    _cachedKey = await importPublicKey(pem);
    _cacheExpiry = now + CACHE_TTL;
    return _cachedKey;
}

/**
 * Encrypt all sensitive fields in a connection form data object.
 * Non-sensitive fields pass through unchanged.
 *
 * @param {string} apiBase   — e.g. ''
 * @param {string} authToken — JWT bearer token
 * @param {object} formData  — the raw form data with plaintext passwords
 * @returns {Promise<object>} — form data with sensitive fields RSA-encrypted
 */
export async function encryptConnectionFields(apiBase, authToken, formData) {
    // If Web Crypto is not available (e.g. non-HTTPS localhost), skip encryption.
    // The backend will still accept plaintext and encrypt with AES for storage.
    if (!crypto?.subtle) {
        console.warn('[FATHOM] Web Crypto unavailable — passwords sent over HTTPS only');
        return formData;
    }

    try {
        const publicKey = await fetchPublicKey(apiBase, authToken);
        const encrypted = { ...formData };

        for (const field of SENSITIVE_FIELDS) {
            const value = encrypted[field];
            if (value && typeof value === 'string' && value.trim()) {
                encrypted[field] = await rsaEncrypt(publicKey, value);
            }
        }

        return encrypted;
    } catch (err) {
        // If handshake fails (e.g. old backend), fall back gracefully
        console.warn('[FATHOM] Client-side encryption unavailable:', err.message);
        return formData;
    }
}

/**
 * Invalidate the cached public key (call after key rotation errors).
 */
export function clearKeyCache() {
    _cachedKey = null;
    _cacheExpiry = 0;
}
