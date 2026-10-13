// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/terraformService.js
 * ────────────────────────────
 * Terraform/IaC export service.
 * Generates Terraform configs and JSON exports from current PulseDB setup.
 */

const S = 'pgmonitoringtool';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * Export all alert rules as Terraform HCL.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string>} Terraform HCL content
 */
export async function exportAlertRules(pool) {
    try {
        const res = await pool.query(
            `SELECT id, name, condition_type, threshold_value, severity, enabled, metadata
             FROM   ${S}.alert_rules
             ORDER  BY name`
        );

        let hcl = '# Alert Rules\n\n';

        for (const rule of res.rows) {
            const safeId = rule.id.toString().replace(/[^a-zA-Z0-9_]/g, '_');
            const meta = rule.metadata ? JSON.stringify(rule.metadata) : '{}';

            hcl += `resource "pulsedb_alert_rule" "${safeId}" {\n`;
            hcl += `  name             = "${escapeHcl(rule.name)}"\n`;
            hcl += `  condition_type   = "${rule.condition_type}"\n`;
            hcl += `  threshold_value  = ${rule.threshold_value}\n`;
            hcl += `  severity         = "${rule.severity}"\n`;
            hcl += `  enabled          = ${rule.enabled}\n`;
            hcl += `  metadata         = jsonencode(${meta})\n`;
            hcl += `}\n\n`;
        }

        return hcl;
    } catch (err) {
        log('WARN', 'Failed to export alert rules', { error: err.message });
        return '# Error exporting alert rules\n';
    }
}

/**
 * Export connection configurations (sanitized, no passwords).
 * @param {import('pg').Pool} pool
 * @returns {Promise<string>} Terraform HCL content
 */
export async function exportConnectionConfigs(pool) {
    try {
        const res = await pool.query(
            `SELECT id, name, host, port, database_name, username, org_id, enabled, metadata
             FROM   ${S}.database_connections
             ORDER  BY name`
        );

        let hcl = '# Database Connections\n\n';

        for (const conn of res.rows) {
            const safeId = `${conn.name}_${conn.id}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

            hcl += `resource "pulsedb_database_connection" "${safeId}" {\n`;
            hcl += `  name          = "${escapeHcl(conn.name)}"\n`;
            hcl += `  host          = "${escapeHcl(conn.host)}"\n`;
            hcl += `  port          = ${conn.port}\n`;
            hcl += `  database_name = "${escapeHcl(conn.database_name)}"\n`;
            hcl += `  username      = "${escapeHcl(conn.username)}"\n`;
            hcl += `  password      = var.database_connections_${safeId}_password  # Set via tfvars\n`;
            hcl += `  enabled       = ${conn.enabled}\n`;
            hcl += `  org_id        = ${conn.org_id}\n`;
            hcl += `}\n\n`;
        }

        // Add variables file section
        hcl += '\n# Add these to terraform.tfvars:\n';
        for (const conn of res.rows) {
            const safeId = `${conn.name}_${conn.id}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
            hcl += `# database_connections_${safeId}_password = "YOUR_PASSWORD_HERE"\n`;
        }

        return hcl;
    } catch (err) {
        log('WARN', 'Failed to export connection configs', { error: err.message });
        return '# Error exporting connection configs\n';
    }
}

/**
 * Export retention policies as IaC.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string>} Terraform HCL content
 */
export async function exportRetentionPolicies(pool) {
    try {
        const res = await pool.query(
            `SELECT org_id, metrics_retention_days, logs_retention_days,
                    alerts_retention_days, audit_retention_days
             FROM   ${S}.retention_policies
             ORDER  BY org_id`
        );

        let hcl = '# Retention Policies\n\n';

        for (const policy of res.rows) {
            const safeId = `org_${policy.org_id}`;

            hcl += `resource "pulsedb_retention_policy" "${safeId}" {\n`;
            hcl += `  org_id                     = ${policy.org_id}\n`;
            hcl += `  metrics_retention_days     = ${policy.metrics_retention_days}\n`;
            hcl += `  logs_retention_days        = ${policy.logs_retention_days}\n`;
            hcl += `  alerts_retention_days      = ${policy.alerts_retention_days}\n`;
            hcl += `  audit_retention_days       = ${policy.audit_retention_days}\n`;
            hcl += `}\n\n`;
        }

        return hcl;
    } catch (err) {
        log('WARN', 'Failed to export retention policies', { error: err.message });
        return '# Error exporting retention policies\n';
    }
}

/**
 * Export user roles and permissions.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string>} Terraform HCL content
 */
export async function exportUserRoles(pool) {
    try {
        const res = await pool.query(
            `SELECT id, username, email, role, org_id, enabled
             FROM   ${S}.users
             WHERE  role != 'guest'
             ORDER  BY username`
        );

        let hcl = '# Users and Roles\n\n';

        for (const user of res.rows) {
            const safeId = user.username.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

            hcl += `resource "pulsedb_user" "${safeId}" {\n`;
            hcl += `  username = "${escapeHcl(user.username)}"\n`;
            hcl += `  email    = "${escapeHcl(user.email)}"\n`;
            hcl += `  role     = "${user.role}"\n`;
            hcl += `  org_id   = ${user.org_id}\n`;
            hcl += `  enabled  = ${user.enabled}\n`;
            hcl += `}\n\n`;
        }

        return hcl;
    } catch (err) {
        log('WARN', 'Failed to export user roles', { error: err.message });
        return '# Error exporting user roles\n';
    }
}

/**
 * Generate complete .tf file bundle as string.
 * @param {import('pg').Pool} pool
 * @returns {Promise<string>} Complete Terraform configuration
 */
export async function generateTerraformBundle(pool) {
    const timestamp = new Date().toISOString();
    const alertRules = await exportAlertRules(pool);
    const connections = await exportConnectionConfigs(pool);
    const retention = await exportRetentionPolicies(pool);
    const userRoles = await exportUserRoles(pool);

    const bundle = `# PulseDB PostgreSQL Monitoring Tool - Terraform Configuration
# Generated: ${timestamp}
# DO NOT EDIT THIS FILE MANUALLY - Regenerate from PulseDB dashboard

terraform {
  required_version = ">= 1.0"
  required_providers {
    pulsedb = {
      source  = "pulsedb/postgresql-monitoring"
      version = "~> 1.0"
    }
  }
}

provider "pulsedb" {
  # Configure provider settings
}

${alertRules}
${connections}
${retention}
${userRoles}
`;

    log('INFO', 'Generated Terraform bundle');
    return bundle;
}

/**
 * Export all configurations as JSON.
 * @param {import('pg').Pool} pool
 * @returns {Promise<object>}
 */
export async function exportAsJSON(pool) {
    try {
        const [alertRes, connRes, policyRes, userRes] = await Promise.all([
            pool.query('SELECT * FROM pgmonitoringtool.alert_rules'),
            pool.query('SELECT id, name, host, port, database_name, username, org_id, enabled FROM pgmonitoringtool.database_connections'),
            pool.query('SELECT * FROM pgmonitoringtool.retention_policies'),
            pool.query('SELECT id, username, email, role, org_id, enabled FROM pgmonitoringtool.users WHERE role != $1', ['guest']),
        ]);

        const exported = {
            exportedAt: new Date().toISOString(),
            alertRules: alertRes.rows,
            databaseConnections: connRes.rows,
            retentionPolicies: policyRes.rows,
            users: userRes.rows,
        };

        log('INFO', 'Exported configuration as JSON', {
            alertRules: alertRes.rowCount,
            connections: connRes.rowCount,
            policies: policyRes.rowCount,
            users: userRes.rowCount,
        });

        return exported;
    } catch (err) {
        log('ERROR', 'Failed to export as JSON', { error: err.message });
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────

/**
 * Escape string for Terraform HCL.
 * @param {string} str
 * @returns {string}
 */
function escapeHcl(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\$/g, '\\$');
}
