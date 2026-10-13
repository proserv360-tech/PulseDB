/**
 * middleware/featureGate.js
 * ─────────────────────────
 * Route-level middleware that checks if a feature is available
 * for the request's organization based on their license tier.
 *
 * Usage:
 *   router.get('/advanced-analytics', authenticate, requireFeature(pool, 'advanced_analysis'), handler);
 */

import { isFeatureEnabled } from '../enterprise/licensing/licenseService.js';
import { isFeatureAvailable, TIERS } from '../enterprise/licensing/tiers.js';

function log(level: any, message: any, meta = {}) {
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...meta }));
}

/**
 * @param {import('pg').Pool} pool
 * @param {string} feature - Feature key to check
 */
export function requireFeature(pool: any, feature: any) {
    return async function (req: any, res: any, next: any) {
        // Super admins bypass feature checks
        if (req.user?.role === 'super_admin') return next();

        const orgId = req.orgId;

        try {
            // If no org context, check if feature is in community tier
            if (!orgId) {
                if (isFeatureAvailable('community', feature)) return next();
                return res.status(403).json({
                    error: 'Feature not available',
                    feature,
                    requiredTier: getRequiredTier(feature),
                    upgrade: true,
                });
            }

            const enabled = await isFeatureEnabled(pool, orgId, feature);
            if (!enabled) {
                return res.status(403).json({
                    error: 'Feature not available in your current plan',
                    feature,
                    requiredTier: getRequiredTier(feature),
                    upgrade: true,
                });
            }
            next();
        } catch (err: any) {
            log('ERROR', 'Feature gate lookup failed', {
                component: 'featureGate',
                feature,
                orgId,
                error: err.message,
            });
            // Fail open for community features, fail closed for enterprise
            if (isFeatureAvailable('community', feature)) return next();
            return res.status(403).json({ error: 'Unable to verify feature access' });
        }
    };
}

/**
 * Determine the minimum tier that includes a feature.
 */
function getRequiredTier(feature: any) {
    for (const tier of ['community', 'pro', 'enterprise']) {
        if (isFeatureAvailable(tier, feature)) return tier;
    }
    return 'enterprise';
}
