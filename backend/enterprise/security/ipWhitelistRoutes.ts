// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/security/ipWhitelistRoutes.js
 * ───────────────────────────────────────
 * Express router for /api/security/ip-whitelist endpoints.
 * IP whitelisting is an enterprise-tier feature.
 */

import { Router } from 'express';
import {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  isIpAllowed,
  getWhitelistStats,
  getTopBlockedIps,
  recordBlockedAttempt,
} from './ipWhitelistService.js';
import { isFeatureEnabled } from '../licensing/licenseService.js';
import { isOrgAdmin } from '../organization/orgService.js';

function log(level, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

export default function ipWhitelistRoutes(pool, authenticate, requireRole) {
  const router = Router();

  /**
   * Middleware to check IP whitelisting feature.
   */
  async function requireIpWhitelistFeature(req, res, next) {
    try {
      const orgId = req.query.orgId || req.params.orgId || req.user?.orgId || 'default';
      const hasFeature = await isFeatureEnabled(pool, orgId, 'ip_whitelisting');

      if (!hasFeature && req.user?.role !== 'super_admin') {
        return res.status(403).json({
          error: 'IP whitelisting feature is not available for your license tier'
        });
      }

      next();
    } catch (err) {
      log('ERROR', 'Feature check failed', { error: err.message });
      res.status(500).json({ error: 'Feature check failed' });
    }
  }

  /**
   * GET /api/security/ip-whitelist
   * List whitelist rules for organization.
   */
  router.get('/', authenticate, requireIpWhitelistFeature, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';

      // Check admin access
      const isAdmin = await isOrgAdmin(pool, orgId, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const whitelist = await getWhitelist(pool, orgId);
      res.json(whitelist);
    } catch (err) {
      log('ERROR', 'Failed to fetch whitelist', { error: err.message });
      res.status(500).json({ error: 'Failed to fetch whitelist' });
    }
  });

  /**
   * POST /api/security/ip-whitelist
   * Add a new whitelist rule.
   * Body: { ip, cidr, label, description }
   */
  router.post('/', authenticate, requireIpWhitelistFeature, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';

      // Check admin access
      const isAdmin = await isOrgAdmin(pool, orgId, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { ip, cidr, label, description } = req.body;

      if (!label) {
        return res.status(400).json({ error: 'Missing label' });
      }

      if (!ip && !cidr) {
        return res.status(400).json({ error: 'Provide either ip or cidr' });
      }

      const rule = await addToWhitelist(pool, orgId, {
        ip,
        cidr,
        label,
        description,
        addedBy: req.user.id,
      });

      log('INFO', 'Whitelist rule added', {
        orgId,
        rule: label,
        ip: ip || cidr,
        userId: req.user.id,
      });
      res.status(201).json(rule);
    } catch (err) {
      log('ERROR', 'Failed to add whitelist rule', { error: err.message });
      res.status(500).json({ error: 'Failed to add whitelist rule' });
    }
  });

  /**
   * DELETE /api/security/ip-whitelist/:id
   * Remove a whitelist rule.
   */
  router.delete('/:id', authenticate, requireIpWhitelistFeature, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';

      // Check admin access
      const isAdmin = await isOrgAdmin(pool, orgId, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const removed = await removeFromWhitelist(pool, req.params.id);
      if (!removed) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      log('INFO', 'Whitelist rule removed', {
        orgId,
        ruleId: req.params.id,
        userId: req.user.id,
      });
      res.json({ success: true });
    } catch (err) {
      log('ERROR', 'Failed to remove whitelist rule', { error: err.message });
      res.status(500).json({ error: 'Failed to remove whitelist rule' });
    }
  });

  /**
   * GET /api/security/ip-whitelist/check
   * Check if current client IP is allowed.
   */
  router.get('/check', authenticate, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';
      const clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

      const allowed = await isIpAllowed(pool, orgId, clientIp);

      res.json({
        clientIp,
        allowed,
        orgId,
      });
    } catch (err) {
      log('ERROR', 'Failed to check IP allowance', { error: err.message });
      res.status(500).json({ error: 'Failed to check IP allowance' });
    }
  });

  /**
   * GET /api/security/ip-whitelist/stats
   * Get whitelist statistics.
   */
  router.get('/stats', authenticate, requireIpWhitelistFeature, async (req, res) => {
    try {
      const orgId = req.query.orgId || req.user?.orgId || 'default';

      // Check admin access
      const isAdmin = await isOrgAdmin(pool, orgId, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const stats = await getWhitelistStats(pool, orgId);
      const topBlocked = await getTopBlockedIps(pool, orgId, 5);

      res.json({
        ...stats,
        topBlockedIps: topBlocked,
      });
    } catch (err) {
      log('ERROR', 'Failed to fetch stats', { error: err.message });
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * POST /api/security/ip-whitelist/block-attempt
   * Record a blocked IP attempt (internal use).
   * Body: { clientIp }
   */
  router.post('/block-attempt', async (req, res) => {
    try {
      const { orgId, clientIp } = req.body;

      if (!orgId || !clientIp) {
        return res.status(400).json({ error: 'Missing orgId or clientIp' });
      }

      const recorded = await recordBlockedAttempt(pool, orgId, clientIp);
      if (!recorded) {
        return res.status(500).json({ error: 'Failed to record attempt' });
      }

      res.json({ success: true });
    } catch (err) {
      log('ERROR', 'Failed to record blocked attempt', { error: err.message });
      res.status(500).json({ error: 'Failed to record attempt' });
    }
  });

  return router;
}
