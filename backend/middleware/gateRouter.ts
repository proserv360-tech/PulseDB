/**
 * middleware/gateRouter.js
 * ─────────────────────────
 * Wrap an entire router (or a sub-set of routes) behind a feature flag.
 *
 * Usage:
 *   const trace = createTraceRouter({ getQueryFn });
 *   app.use('/', gateRouter(pool, 'trace_correlation', trace));
 *
 *   const scim = createScimRouter({ scimService, authenticate: scimAuth });
 *   app.use('/scim/v2', gateRouter(pool, 'scim_provisioning', scim));
 *
 * The gate relies on requireFeature(pool, feature) and therefore honours the
 * existing tier → feature mapping in enterprise/licensing/tiers.js.
 *
 * Super admins bypass the gate (as in requireFeature).
 * Requests that fail the gate receive the same 403 shape produced by
 * requireFeature, so UI error handling is uniform.
 */

import express from 'express';
import { requireFeature } from './featureGate.js';

/**
 * @param {import('pg').Pool} pool
 * @param {string} feature  — feature key as defined in tiers.js
 * @param {import('express').Router} innerRouter
 * @returns {import('express').Router}
 */
export function gateRouter(pool: any, feature: any, innerRouter: any) {
    const router = express.Router();
    router.use(requireFeature(pool, feature));
    router.use(innerRouter);
    return router;
}

/**
 * Variant that accepts a map of prefix → feature key, useful when a single
 * router has endpoints with mixed tier requirements.
 *
 *   gateByPath(pool, {
 *       '/page': 'anomaly_detection_page',
 *   }, router);
 *
 * The gate is applied on method-less Router.use so it matches all verbs
 * for the prefix. Paths not listed are un-gated.
 */
export function gateByPath(pool: any, map: any, innerRouter: any) {
    const router = express.Router();
    for (const [prefix, feature] of Object.entries(map)) {
        router.use(prefix, requireFeature(pool, feature));
    }
    router.use(innerRouter);
    return router;
}

export default gateRouter;
