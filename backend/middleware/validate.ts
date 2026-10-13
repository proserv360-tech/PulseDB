/**
 * middleware/validate.js
 * B5 — Zod-driven request validation middleware.
 *
 * Replaces ad-hoc `if (!req.body.x) return res.status(400)...` boilerplate
 * with a single source of truth that lives in @pulsedb/validators. The
 * shared schema is used by the frontend (form validation) and the backend
 * (request validation), so a rename in one place breaks the type check in
 * the other.
 *
 * Usage:
 *   import { validate } from '../middleware/validate.js';
 *   import { CreateAlertRuleSchema } from '@pulsedb/validators';
 *
 *   router.post('/alerts',
 *     authenticate,
 *     validate({ body: CreateAlertRuleSchema }),
 *     async (req, res) => {
 *       // req.validatedBody is the parsed (and possibly defaulted) value.
 *       // req.body still holds the original, in case a handler needs it.
 *     });
 *
 * On validation failure the middleware responds with:
 *   { error: 'Validation failed', issues: [{ path, message, code }] }
 * and HTTP 400. Issues are the flattened Zod issues, which the FE can
 * map to per-field error states.
 */

function flatten(issues: any) {
    return issues.map((i: any) => ({
        path: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
        message: i.message,
        code: i.code,
    }));
}

function runOne(schema: any, value: any) {
    if (!schema || typeof schema.safeParse !== 'function') {
        return { ok: true, value };
    }
    const r = schema.safeParse(value);
    if (r.success) return { ok: true, value: r.data };
    return { ok: false, issues: flatten(r.error.issues || r.error.errors || []) };
}

/**
 * Build a validation middleware for any combination of body / query / params.
 *
 * @param {{
 *   body?:   import('zod').ZodTypeAny,
 *   query?:  import('zod').ZodTypeAny,
 *   params?: import('zod').ZodTypeAny,
 * }} schemas
 */
export function validate(schemas: Record<string, any> = {}) {
    return function validateMiddleware(req: any, res: any, next: any) {
        if (schemas.body) {
            const r = runOne(schemas.body, req.body);
            if (!r.ok) return res.status(400).json({ error: 'Validation failed', source: 'body', issues: r.issues });
            req.validatedBody = r.value;
        }
        if (schemas.query) {
            const r = runOne(schemas.query, req.query);
            if (!r.ok) return res.status(400).json({ error: 'Validation failed', source: 'query', issues: r.issues });
            req.validatedQuery = r.value;
        }
        if (schemas.params) {
            const r = runOne(schemas.params, req.params);
            if (!r.ok) return res.status(400).json({ error: 'Validation failed', source: 'params', issues: r.issues });
            req.validatedParams = r.value;
        }
        return next();
    };
}

export default validate;
