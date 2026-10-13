// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/licensing/licenseRoutes.js
 * ────────────────────────────────────
 * Express router for /api/license endpoints.
 * GET / - current license info
 * POST /activate - activate a new license
 * GET /usage - usage statistics
 * GET /features - available features
 */

import { Router } from 'express';
import {
  getCurrentLicense,
  activateLicense,
  getLicenseUsage,
  listAllLicenses,
  validateLicenseKeyFormat,
} from './licenseService.js';
import { getFeaturesForTier, getTierConfig } from './tiers.js';

function log(level, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

// ─────────────────────────────────────────────────────────────────────────────
// License Activation Rate Limiting (max 5 per hour per user)
// ─────────────────────────────────────────────────────────────────────────────
const licenseActivationAttempts = new Map();
const LICENSE_ACTIVATION_WINDOW = 60 * 60 * 1000; // 1 hour
const LICENSE_ACTIVATION_MAX = 5; // max 5 activations per hour

function checkLicenseActivationRateLimit(userId) {
  const now = Date.now();
  let record = licenseActivationAttempts.get(userId);

  if (!record || now - record.windowStart > LICENSE_ACTIVATION_WINDOW) {
    // Create or reset bucket
    record = { count: 0, windowStart: now };
    licenseActivationAttempts.set(userId, record);
  }

  record.count++;
  return {
    allowed: record.count <= LICENSE_ACTIVATION_MAX,
    remaining: Math.max(0, LICENSE_ACTIVATION_MAX - record.count),
    resetTime: record.windowStart + LICENSE_ACTIVATION_WINDOW
  };
}

// Cleanup stale records every hour
if (process.env.VERCEL !== '1') {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, record] of licenseActivationAttempts) {
      if (now - record.windowStart > 2 * LICENSE_ACTIVATION_WINDOW) {
        licenseActivationAttempts.delete(userId);
      }
    }
  }, 60 * 60 * 1000);
}

export default function licenseRoutes(pool, authenticate, requireRole) {
  const router = Router();

  /**
   * GET /api/license
   * Get current license info for authenticated user's organization.
   */
  router.get('/', authenticate, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';
      const license = await getCurrentLicense(pool, orgId);

      if (!license) {
        return res.json({
          tier: 'community',
          status: 'not_licensed',
          features: getFeaturesForTier('community'),
          limits: getTierConfig('community'),
        });
      }

      return res.json(license);
    } catch (err) {
      log('ERROR', 'Failed to get license', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve license' });
    }
  });

  /**
   * POST /api/license/activate
   * Activate a new license key (super_admin only).
   * Body: { licenseKey, orgId }
   * Rate limited: max 5 activations per hour per user
   */
  router.post('/activate', authenticate, requireRole('super_admin'), async (req, res) => {
    try {
      const { licenseKey, orgId } = req.body;

      if (!licenseKey || !orgId) {
        return res.status(400).json({ error: 'Missing licenseKey or orgId' });
      }

      // Check rate limit
      const rateLimitCheck = checkLicenseActivationRateLimit(req.user.id);
      res.setHeader('X-RateLimit-Limit', String(LICENSE_ACTIVATION_MAX));
      res.setHeader('X-RateLimit-Remaining', String(rateLimitCheck.remaining));
      res.setHeader('X-RateLimit-Reset', String(rateLimitCheck.resetTime));

      if (!rateLimitCheck.allowed) {
        log('WARN', 'License activation rate limit exceeded', {
          userId: req.user.id,
          orgId
        });
        return res.status(429).json({
          error: `Too many license activation attempts. Maximum ${LICENSE_ACTIVATION_MAX} per hour.`
        });
      }

      const licenseSecret = process.env.LICENSE_SECRET;
      if (!licenseSecret) {
        log('ERROR', 'LICENSE_SECRET not configured', {});
        return res.status(500).json({ error: 'License service not configured' });
      }

      // Verify user's organization
      if (req.user?.orgId && req.user.orgId !== orgId) {
        log('WARN', 'Attempted license activation for unauthorized organization', {
          userId: req.user.id,
          requestedOrgId: orgId,
          userOrgId: req.user.orgId
        });
        return res.status(403).json({ error: 'You cannot activate licenses for other organizations' });
      }

      const result = await activateLicense(pool, licenseKey, orgId, licenseSecret);

      if (!result.success) {
        log('WARN', 'License activation failed', {
          userId: req.user.id,
          orgId,
          error: result.error
        });
        return res.status(400).json({ error: result.error });
      }

      // Audit log for successful license activation
      log('INFO', 'License activated', {
        userId: req.user.id,
        username: req.user.username,
        orgId,
        tier: result.license.tier,
        expiresAt: result.license.expiresAt
      });

      res.json({ success: true, license: result.license });
    } catch (err) {
      log('ERROR', 'Failed to activate license', {
        error: err.message,
        userId: req.user?.id
      });
      res.status(500).json({ error: 'Failed to activate license' });
    }
  });

  /**
   * GET /api/license/usage
   * Get license usage stats and capacity.
   */
  router.get('/usage', authenticate, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';
      const usage = await getLicenseUsage(pool, orgId);
      res.json(usage);
    } catch (err) {
      log('ERROR', 'Failed to get license usage', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve usage' });
    }
  });

  /**
   * GET /api/license/features
   * List available features for current tier.
   */
  router.get('/features', authenticate, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';
      const license = await getCurrentLicense(pool, orgId);
      const tier = license?.tier ?? 'community';
      const features = getFeaturesForTier(tier);

      res.json({
        tier,
        features,
        tierConfig: getTierConfig(tier),
      });
    } catch (err) {
      log('ERROR', 'Failed to get features', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve features' });
    }
  });

  /**
   * GET /api/license/all
   * List all licenses (super_admin only).
   */
  router.get('/all', authenticate, requireRole('super_admin'), async (req, res) => {
    try {
      const licenses = await listAllLicenses(pool);
      res.json(licenses);
    } catch (err) {
      log('ERROR', 'Failed to list licenses', { error: err.message });
      res.status(500).json({ error: 'Failed to list licenses' });
    }
  });

  /**
   * POST /api/license/validate
   * Validate a license key format without activating.
   * Body: { licenseKey }
   */
  router.post('/validate', authenticate, requireRole('super_admin'), (req, res) => {
    try {
      const { licenseKey } = req.body;

      if (!licenseKey) {
        return res.status(400).json({ error: 'Missing licenseKey' });
      }

      const licenseSecret = process.env.LICENSE_SECRET;
      if (!licenseSecret) {
        log('ERROR', 'LICENSE_SECRET not configured', {});
        return res.status(500).json({ error: 'License service not configured' });
      }

      const result = validateLicenseKeyFormat(licenseKey, licenseSecret);

      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        valid: true,
        tier: result.tier,
        orgHash: result.orgHash,
      });
    } catch (err) {
      log('ERROR', 'Failed to validate license', { error: err.message });
      res.status(500).json({ error: 'Failed to validate license' });
    }
  });

  return router;
}