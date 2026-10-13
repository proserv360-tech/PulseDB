// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/licensing/tiers.js
 * ─────────────────────────────
 * Define the 3 license tiers with feature flags and resource limits.
 * Used by licenseService to validate and enforce tier-based access.
 */

export const TIERS = {
  community: {
    name: 'Community',
    features: [
      'overview', 'performance', 'resources', 'indexes',
      'sql_console', 'alerts_basic', 'vacuum_maintenance',
      // ── Roadmap §7.4: Community gets Redis + one notifier ─────────────
      'adapter_redis',
      'notifiers_webhook',
    ],
    maxConnections: 2,
    maxUsers: 5,
    retentionDays: 7,
  },
  pro: {
    name: 'Professional',
    features: [
      // all community features plus:
      'overview', 'performance', 'resources', 'indexes',
      'sql_console', 'alerts_basic', 'vacuum_maintenance',
      'query_optimizer', 'bloat_analysis', 'replication_wal',
      'backup_recovery', 'checkpoint_monitor', 'capacity_planning',
      'schema_versioning', 'api_queries', 'repository',
      'alerts_advanced', 'cloudwatch', 'log_pattern_analysis',
      // ── Roadmap §7.4: Pro adds Teams + ES + anomaly detection ─────────
      'adapter_redis', 'adapter_elasticsearch',
      'notifiers_webhook', 'notifiers_teams', 'notifiers_pagerduty',
      'anomaly_detection_suggest',
      'trace_correlation',
    ],
    maxConnections: 10,
    maxUsers: 25,
    retentionDays: 30,
  },
  enterprise: {
    name: 'Enterprise',
    features: [
      // all pro features plus:
      'overview', 'performance', 'resources', 'indexes',
      'sql_console', 'alerts_basic', 'vacuum_maintenance',
      'query_optimizer', 'bloat_analysis', 'replication_wal',
      'backup_recovery', 'checkpoint_monitor', 'capacity_planning',
      'schema_versioning', 'api_queries', 'repository',
      'alerts_advanced', 'cloudwatch', 'log_pattern_analysis',
      'sso_saml', 'ip_whitelisting', 'audit_enhanced',
      'multi_tenancy', 'alert_correlation', 'dba_task_scheduler',
      'security_compliance', 'table_analytics', 'connection_pool',
      'query_plan_regression', 'custom_dashboards', 'advanced_analysis',
      'user_management_advanced', 'api_keys_unlimited',
      // ── Roadmap §7.4: Enterprise unlocks everything ───────────────────
      'adapter_redis', 'adapter_elasticsearch',
      'notifiers_webhook', 'notifiers_teams', 'notifiers_pagerduty', 'notifiers_opsgenie',
      'anomaly_detection_suggest', 'anomaly_detection_page',
      'trace_correlation',
      'scim_provisioning',
      'audit_log_tamper_evident',
    ],
    maxConnections: -1, // unlimited
    maxUsers: -1, // unlimited
    retentionDays: 365,
  }
};

/**
 * Get all features for a tier (includes lower tiers).
 * @param {string} tier - One of 'community', 'pro', 'enterprise'
 * @returns {string[]} Array of feature identifiers
 */
export function getFeaturesForTier(tier) {
  const tierConfig = TIERS[tier];
  if (!tierConfig) return [];
  return tierConfig.features;
}

/**
 * Get the configuration object for a tier.
 * @param {string} tier - One of 'community', 'pro', 'enterprise'
 * @returns {object|null} Tier config or null if invalid
 */
export function getTierConfig(tier) {
  return TIERS[tier] ?? null;
}

/**
 * Check if a feature is available in a tier.
 * @param {string} tier - One of 'community', 'pro', 'enterprise'
 * @param {string} feature - Feature identifier to check
 * @returns {boolean} True if feature is available
 */
export function isFeatureAvailable(tier, feature) {
  const config = getTierConfig(tier);
  if (!config) return false;
  return config.features.includes(feature);
}

/**
 * Get the tier name.
 * @param {string} tier - One of 'community', 'pro', 'enterprise'
 * @returns {string} Human-readable tier name
 */
export function getTierName(tier) {
  const config = getTierConfig(tier);
  return config?.name ?? 'Unknown';
}
