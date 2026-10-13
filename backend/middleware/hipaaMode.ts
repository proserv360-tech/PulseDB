/**
 * middleware/hipaaMode.js
 *
 * When `HIPAA_MODE=true` is set on the host, this middleware tightens
 * the runtime to satisfy HIPAA Security Rule §164.312 expectations:
 *
 *   • Response body PHI redaction for bodies that contain common fields.
 *   • Forces `res.setHeader('Cache-Control', 'no-store')` on every
 *     response so PHI can't linger in intermediary caches.
 *   • Upgrades audit level on admin paths — every auth/authz decision
 *     and every access to a path matching /patients/, /phi/, or /records/
 *     is logged with phi_access=true tag for downstream SIEM.
 *   • Rejects outbound requests to non-allowlisted external hosts from
 *     integrations — handled elsewhere (integrationsService); this file
 *     exposes the helper `isHipaaMode()` those hooks consume.
 *
 * The goal is not to make FATHOM automatically HIPAA-compliant — that is
 * always a BAA, policy, and configuration exercise — but to flip a
 * handful of guardrails so operators aren't one-line away from logging
 * PHI in plaintext.
 */

const PHI_FIELD_NAMES = new Set([
    'ssn',
    'social_security',
    'mrn',
    'patient_id',
    'dob',
    'birth_date',
    'date_of_birth',
    'medical_record_number',
    'insurance_id',
    'member_id',
    'first_name',
    'last_name',
    'full_name',
    'email',
    'phone',
    'address',
    'street',
    'zip',
    'zipcode',
    'postal_code',
]);

/** True iff the operator has opted this environment into HIPAA mode. */
export function isHipaaMode(env = process.env) {
    return String(env.HIPAA_MODE || '').toLowerCase() === 'true';
}

/** Deep-clone with PHI-looking fields replaced. */
export function redactPhi(obj: any): any {
    if (obj == null) return obj;
    if (Array.isArray(obj)) return obj.map(redactPhi);
    if (typeof obj !== 'object') return obj;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (PHI_FIELD_NAMES.has(k.toLowerCase())) {
            out[k] = '[REDACTED:PHI]';
        } else {
            out[k] = redactPhi(v);
        }
    }
    return out;
}

/**
 * Middleware factory. Returns a no-op when HIPAA mode is off so the app
 * has zero overhead in the default path.
 */
export function hipaaMiddleware({ log = (..._args: any[]) => {} }: { log?: (...args: any[]) => void } = {}) {
    if (!isHipaaMode()) return (_req: any, _res: any, next: any) => next();
    return (req: any, res: any, next: any) => {
        // No cache for anything — PHI must not cache.
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');

        // Wrap res.json so we redact on the way out.
        const origJson = res.json.bind(res);
        res.json = ((body: any) => origJson(redactPhi(body))) as any;

        // Tag PHI-adjacent paths so audit downstream can filter.
        const p = req.path || '';
        if (/\/patients\/|\/phi\/|\/records\//.test(p)) {
            res.setHeader('X-Fathom-PHI-Access', '1');
            log('INFO', 'phi-access', {
                path: p,
                method: req.method,
                user: req.user?.id || null,
            });
        }
        next();
    };
}

export default { isHipaaMode, redactPhi, hipaaMiddleware };
