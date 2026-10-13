// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/index.js
 * ──────────────────
 * Central export and router mount for all enterprise features.
 * Wires up licensing, organization, and security routes.
 * Check license tier before mounting advanced features.
 */

import licenseRoutes from './licensing/licenseRoutes.js';
import orgRoutes from './organization/orgRoutes.js';
import ipWhitelistRoutes from './security/ipWhitelistRoutes.js';

import {
  TIERS,
  getFeaturesForTier,
  getTierConfig,
  isFeatureAvailable,
  getTierName,
} from './licensing/tiers.js';

import {
  generateLicenseKey,
  validateLicenseKeyFormat,
  activateLicense,
  getCurrentLicense,
  isFeatureEnabled,
  getLicenseUsage,
  isConnectionLimitReached,
  isUserLimitReached,
  listAllLicenses,
  revokeLicense,
} from './licensing/licenseService.js';

import {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  listOrganizations,
  getUserOrganizations,
  updateOrganization,
  addUserToOrg,
  removeUserFromOrg,
  updateMemberRole,
  getOrgMembers,
  getOrgMember,
  getOrgMemberCount,
  isOrgMember,
  isOrgAdmin,
  isSlugAvailable,
} from './organization/orgService.js';

import {
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  isIpAllowed,
  getWhitelistStats,
  getTopBlockedIps,
  recordBlockedAttempt,
  getWhitelistRule,
  clearOldBlockedAttempts,
} from './security/ipWhitelistService.js';

/**
 * Mount all enterprise routes to the Express app.
 * Called from server.js after initial setup.
 *
 * @param {object} app - Express application
 * @param {object} pool - PostgreSQL connection pool
 * @param {function} authenticate - Authentication middleware
 * @param {function} requireRole - Role-based access middleware
 * @param {function} requireScreen - Screen-based access middleware (optional)
 */
export function mountEnterpriseRoutes(app, pool, authenticate, requireRole, requireScreen) {
  // Mount licensing routes at /api/license
  app.use('/api/license', licenseRoutes(pool, authenticate, requireRole));

  // Mount organization routes at /api/organizations
  app.use('/api/organizations', orgRoutes(pool, authenticate, requireRole));

  // Mount IP whitelist routes at /api/security/ip-whitelist
  app.use('/api/security/ip-whitelist', ipWhitelistRoutes(pool, authenticate, requireRole));

  console.log('[ENTERPRISE] All enterprise routes mounted successfully');
}

/**
 * Pre-flight check for enterprise features.
 * Can be called during server startup to validate configuration.
 *
 * @returns {object} Status report
 */
export function validateEnterpriseSetup() {
  const licenseSecret = process.env.LICENSE_SECRET;
  const issues = [];

  if (!licenseSecret || licenseSecret === 'change-me-in-production') {
    issues.push('WARNING: LICENSE_SECRET not set or still at default value');
  }

  return {
    ready: issues.length === 0,
    issues,
    tiers: Object.keys(TIERS),
    features: {
      licensing: true,
      organization: true,
      security: true,
    },
  };
}

/* ─── EXPORTS ──────────────────────────────────────────────────────────────── */

export {
  // Licensing
  TIERS,
  getFeaturesForTier,
  getTierConfig,
  isFeatureAvailable,
  getTierName,
  generateLicenseKey,
  validateLicenseKeyFormat,
  activateLicense,
  getCurrentLicense,
  isFeatureEnabled,
  getLicenseUsage,
  isConnectionLimitReached,
  isUserLimitReached,
  listAllLicenses,
  revokeLicense,
  // Organization
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  listOrganizations,
  getUserOrganizations,
  updateOrganization,
  addUserToOrg,
  removeUserFromOrg,
  updateMemberRole,
  getOrgMembers,
  getOrgMember,
  getOrgMemberCount,
  isOrgMember,
  isOrgAdmin,
  isSlugAvailable,
  // IP Whitelist
  getWhitelist,
  addToWhitelist,
  removeFromWhitelist,
  isIpAllowed,
  getWhitelistStats,
  getTopBlockedIps,
  recordBlockedAttempt,
  getWhitelistRule,
  clearOldBlockedAttempts,
};
