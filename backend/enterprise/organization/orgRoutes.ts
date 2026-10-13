// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/organization/orgRoutes.js
 * ───────────────────────────────────
 * Express router for /api/organizations endpoints.
 * Multi-tenancy organization management.
 */

import { Router } from 'express';
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
  getUserOrganizations,
  addUserToOrg,
  removeUserFromOrg,
  updateMemberRole,
  getOrgMembers,
  getOrgMember,
  isOrgAdmin,
  isSlugAvailable,
  getOrgMemberCount,
} from './orgService.js';
import { isFeatureEnabled } from '../licensing/licenseService.js';

function log(level, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

export default function orgRoutes(pool, authenticate, requireRole) {
  const router = Router();

  /**
   * GET /api/organizations
   * List user's organizations.
   */
  router.get('/', authenticate, async (req, res) => {
    try {
      const orgs = await getUserOrganizations(pool, req.user.id);
      res.json(orgs);
    } catch (err) {
      log('ERROR', 'Failed to list organizations', { error: err.message });
      res.status(500).json({ error: 'Failed to list organizations' });
    }
  });

  /**
   * POST /api/organizations
   * Create a new organization (enterprise tier only).
   * Body: { name, slug, description }
   */
  router.post('/', authenticate, async (req, res) => {
    try {
      // Check if multi_tenancy is enabled
      const hasFeature = await isFeatureEnabled(pool, req.user.orgId || 'default', 'multi_tenancy');
      if (!hasFeature && req.user.role !== 'super_admin') {
        return res.status(403).json({
          error: 'Multi-tenancy feature is not available for your license tier'
        });
      }

      const { name, slug, description } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ error: 'Missing required fields: name, slug' });
      }

      // Check slug availability
      const available = await isSlugAvailable(pool, slug);
      if (!available) {
        return res.status(409).json({ error: 'Slug is already taken' });
      }

      // Create organization
      const org = await createOrganization(pool, {
        name,
        slug,
        ownerId: req.user.id,
        description: description || null,
      });

      // Add creator as owner
      await addUserToOrg(pool, org.id, req.user.id, 'owner');

      log('INFO', 'Organization created', { orgId: org.id, userId: req.user.id });
      res.status(201).json(org);
    } catch (err) {
      log('ERROR', 'Failed to create organization', { error: err.message });
      if (err.message.includes('already exists')) {
        return res.status(409).json({ error: err.message });
      }
      res.status(500).json({ error: 'Failed to create organization' });
    }
  });

  /**
   * GET /api/organizations/:id
   * Get organization details.
   */
  router.get('/:id', authenticate, async (req, res) => {
    try {
      const org = await getOrganization(pool, req.params.id);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Check if user is member (unless super_admin)
      if (req.user.role !== 'super_admin') {
        const isMember = await isSlugAvailable(pool, req.params.id);
        if (isMember) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json(org);
    } catch (err) {
      log('ERROR', 'Failed to get organization', { error: err.message });
      res.status(500).json({ error: 'Failed to get organization' });
    }
  });

  /**
   * PUT /api/organizations/:id
   * Update organization (admin only).
   * Body: { name, description }
   */
  router.put('/:id', authenticate, async (req, res) => {
    try {
      const isAdmin = await isOrgAdmin(pool, req.params.id, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const org = await updateOrganization(pool, req.params.id, req.body);
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      log('INFO', 'Organization updated', { orgId: org.id, userId: req.user.id });
      res.json(org);
    } catch (err) {
      log('ERROR', 'Failed to update organization', { error: err.message });
      res.status(500).json({ error: 'Failed to update organization' });
    }
  });

  /**
   * GET /api/organizations/:id/members
   * List organization members.
   */
  router.get('/:id/members', authenticate, async (req, res) => {
    try {
      // Verify user is member or admin
      const isAdmin = await isOrgAdmin(pool, req.params.id, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const members = await getOrgMembers(pool, req.params.id);
      res.json(members);
    } catch (err) {
      log('ERROR', 'Failed to list members', { error: err.message });
      res.status(500).json({ error: 'Failed to list members' });
    }
  });

  /**
   * POST /api/organizations/:id/members
   * Add a user to organization (admin only).
   * Body: { userId, role }
   */
  router.post('/:id/members', authenticate, async (req, res) => {
    try {
      const isAdmin = await isOrgAdmin(pool, req.params.id, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { userId, role = 'member' } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      // Check user limit
      const count = await getOrgMemberCount(pool, req.params.id);
      const limitReached = await isFeatureEnabled(pool, req.params.id, 'multi_tenancy');
      // If multi_tenancy is disabled and we're at max (e.g., 5 for community), block
      if (!limitReached && count >= 5) {
        return res.status(403).json({
          error: 'User limit reached for your license tier'
        });
      }

      const member = await addUserToOrg(pool, req.params.id, userId, role);
      if (!member) {
        return res.status(400).json({ error: 'Failed to add member' });
      }

      log('INFO', 'Member added to organization', { orgId: req.params.id, userId, addedBy: req.user.id });
      res.status(201).json(member);
    } catch (err) {
      log('ERROR', 'Failed to add member', { error: err.message });
      res.status(500).json({ error: 'Failed to add member' });
    }
  });

  /**
   * DELETE /api/organizations/:id/members/:userId
   * Remove a user from organization (admin only).
   */
  router.delete('/:id/members/:userId', authenticate, async (req, res) => {
    try {
      const isAdmin = await isOrgAdmin(pool, req.params.id, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Don't allow removing yourself as last owner
      if (req.params.userId === req.user.id) {
        const member = await getOrgMember(pool, req.params.id, req.user.id);
        if (member?.role === 'owner') {
          const members = await getOrgMembers(pool, req.params.id);
          const otherOwners = members.filter(m => m.role === 'owner' && m.userId !== req.user.id);
          if (otherOwners.length === 0) {
            return res.status(400).json({
              error: 'Cannot remove the last owner. Add another owner first.'
            });
          }
        }
      }

      const removed = await removeUserFromOrg(pool, req.params.id, req.params.userId);
      if (!removed) {
        return res.status(404).json({ error: 'Member not found' });
      }

      log('INFO', 'Member removed from organization', {
        orgId: req.params.id,
        userId: req.params.userId,
        removedBy: req.user.id
      });
      res.json({ success: true });
    } catch (err) {
      log('ERROR', 'Failed to remove member', { error: err.message });
      res.status(500).json({ error: 'Failed to remove member' });
    }
  });

  /**
   * PUT /api/organizations/:id/members/:userId
   * Update member role (admin only).
   * Body: { role }
   */
  router.put('/:id/members/:userId', authenticate, async (req, res) => {
    try {
      const isAdmin = await isOrgAdmin(pool, req.params.id, req.user.id);
      if (!isAdmin && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { role } = req.body;
      if (!role || !['owner', 'admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const member = await updateMemberRole(pool, req.params.id, req.params.userId, role);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      log('INFO', 'Member role updated', {
        orgId: req.params.id,
        userId: req.params.userId,
        newRole: role,
        updatedBy: req.user.id
      });
      res.json(member);
    } catch (err) {
      log('ERROR', 'Failed to update member role', { error: err.message });
      res.status(500).json({ error: 'Failed to update member role' });
    }
  });

  /**
   * GET /api/organizations/slug/:slug
   * Check if a slug is available.
   */
  router.get('/slug/:slug', async (req, res) => {
    try {
      const available = await isSlugAvailable(pool, req.params.slug);
      res.json({ available, slug: req.params.slug });
    } catch (err) {
      log('ERROR', 'Failed to check slug', { error: err.message });
      res.status(500).json({ error: 'Failed to check slug' });
    }
  });

  /**
   * GET /api/organizations/all (admin only)
   * List all organizations.
   */
  router.get('/admin/all', authenticate, requireRole('super_admin'), async (req, res) => {
    try {
      const orgs = await listOrganizations(pool);
      res.json(orgs);
    } catch (err) {
      log('ERROR', 'Failed to list all organizations', { error: err.message });
      res.status(500).json({ error: 'Failed to list organizations' });
    }
  });

  return router;
}
