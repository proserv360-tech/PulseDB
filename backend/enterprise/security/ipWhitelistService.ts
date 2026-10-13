// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * enterprise/security/ipWhitelistService.js
 * ────────────────────────────────────────
 * IP whitelisting service for enterprise security.
 * Manages allowed IPs/CIDRs for organizations.
 */

// SECURITY (audit H-3): CIDR matching delegates to the single vetted
// implementation in middleware/ipAllowList.js (correct bitwise IPv4/IPv6).
// The previous local isIpInCidr() was a string-prefix placeholder that both
// over- and under-matched, giving a false sense of security.
import { ipInCidr } from '../../middleware/ipAllowList.js';

const S = 'pgmonitoringtool';

/* ─── ROW NORMALISER ───────────────────────────────────────────────────────── */

function toClientRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    ip: row.ip_address,
    cidr: row.cidr_block,
    label: row.label,
    description: row.description ?? null,
    addedBy: row.added_by,
    blockedAttempts: Number(row.blocked_attempts ?? 0),
    createdAt: row.created_at,
  };
}

/* ─── HELPERS ──────────────────────────────────────────────────────────────── */

/**
 * Check if an IP is in a CIDR block.
 * Simple implementation — for production use ipaddr.js library.
 * @param {string} ip - IP address to check
 * @param {string} cidr - CIDR block (e.g., '192.168.1.0/24')
 * @returns {boolean} True if IP is in CIDR
 */
function isIpInCidr(ip, cidr) {
  // Delegates to the vetted CIDR matcher (audit H-3).
  if (!cidr) return false;
  if (!cidr.includes('/')) return ip === cidr; // exact IP
  return ipInCidr(ip, cidr);
}

/* ─── CREATE ───────────────────────────────────────────────────────────────── */

/**
 * Add an IP or CIDR to the whitelist.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {object} data - { ip, cidr, label, description, addedBy }
 * @returns {object|null} Created rule or null
 */
export async function addToWhitelist(pool, orgId, data) {
  const {
    ip = null,
    cidr = null,
    label,
    description = null,
    addedBy,
  } = data;

  if (!label || !addedBy) {
    throw new Error('Missing required fields: label, addedBy');
  }

  if (!ip && !cidr) {
    throw new Error('Provide either ip or cidr');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO ${S}.ip_whitelist (org_id, ip_address, cidr_block, label, description, added_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, ip, cidr, label, description, addedBy]
    );
    return toClientRule(rows[0]);
  } catch (err) {
    console.error('Error adding to whitelist:', err);
    throw err;
  }
}

/* ─── READ ─────────────────────────────────────────────────────────────────── */

/**
 * Get all whitelist rules for an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @returns {object[]} Array of whitelist rules
 */
export async function getWhitelist(pool, orgId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${S}.ip_whitelist
       WHERE org_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC`,
      [orgId]
    );
    return rows.map(toClientRule);
  } catch (err) {
    console.error('Error fetching whitelist:', err);
    return [];
  }
}

/**
 * Get a specific whitelist rule.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} ruleId - Rule ID
 * @returns {object|null} Rule or null
 */
export async function getWhitelistRule(pool, ruleId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ${S}.ip_whitelist WHERE id = $1`, [ruleId]
    );
    return rows[0] ? toClientRule(rows[0]) : null;
  } catch (err) {
    console.error('Error fetching whitelist rule:', err);
    return null;
  }
}

/* ─── DELETE ───────────────────────────────────────────────────────────────── */

/**
 * Remove a whitelist rule (soft delete).
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} ruleId - Rule ID
 * @returns {boolean} True if removed
 */
export async function removeFromWhitelist(pool, ruleId) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE ${S}.ip_whitelist SET is_active = FALSE, deleted_at = NOW() WHERE id = $1`,
      [ruleId]
    );
    return rowCount > 0;
  } catch (err) {
    console.error('Error removing from whitelist:', err);
    return false;
  }
}

/* ─── VALIDATION ───────────────────────────────────────────────────────────── */

/**
 * Check if an IP is allowed to access an organization.
 * Returns true if whitelist is empty (not enabled) or IP is in whitelist.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} clientIp - Client IP to check
 * @returns {boolean} True if IP is allowed
 */
export async function isIpAllowed(pool, orgId, clientIp) {
  try {
    // Get all whitelist rules for org
    const whitelist = await getWhitelist(pool, orgId);

    // If no rules, allow all (whitelist not enabled)
    if (whitelist.length === 0) {
      return true;
    }

    // Check if IP matches any rule
    for (const rule of whitelist) {
      if (rule.ip === clientIp) {
        return true;
      }
      if (rule.cidr && isIpInCidr(clientIp, rule.cidr)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error checking IP allowance:', err);
    return true; // Fail open on error
  }
}

/**
 * Record a blocked IP attempt.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {string} clientIp - Client IP that was blocked
 * @returns {boolean} True if recorded
 */
export async function recordBlockedAttempt(pool, orgId, clientIp) {
  try {
    await pool.query(
      `INSERT INTO ${S}.ip_whitelist_blocked_attempts (org_id, ip_address)
       VALUES ($1, $2)`,
      [orgId, clientIp]
    );
    return true;
  } catch (err) {
    console.error('Error recording blocked attempt:', err);
    return false;
  }
}

/* ─── STATISTICS ───────────────────────────────────────────────────────────── */

/**
 * Get whitelist statistics for an organization.
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @returns {object} Stats object
 */
export async function getWhitelistStats(pool, orgId) {
  try {
    // Total rules
    const rulesResult = await pool.query(
      `SELECT COUNT(*)::int as count FROM ${S}.ip_whitelist
       WHERE org_id = $1 AND is_active = TRUE`,
      [orgId]
    );

    // Blocked attempts in last 24 hours
    const blockedResult = await pool.query(
      `SELECT COUNT(*)::int as count FROM ${S}.ip_whitelist_blocked_attempts
       WHERE org_id = $1 AND attempted_at > NOW() - INTERVAL '24 hours'`,
      [orgId]
    );

    // Unique IPs blocked
    const uniqueResult = await pool.query(
      `SELECT COUNT(DISTINCT ip_address)::int as count FROM ${S}.ip_whitelist_blocked_attempts
       WHERE org_id = $1 AND attempted_at > NOW() - INTERVAL '24 hours'`,
      [orgId]
    );

    return {
      totalRules: rulesResult.rows[0]?.count ?? 0,
      blockedAttempts24h: blockedResult.rows[0]?.count ?? 0,
      uniqueBlockedIps24h: uniqueResult.rows[0]?.count ?? 0,
      whitelistEnabled: (rulesResult.rows[0]?.count ?? 0) > 0,
    };
  } catch (err) {
    console.error('Error fetching whitelist stats:', err);
    return { totalRules: 0, blockedAttempts24h: 0, uniqueBlockedIps24h: 0, whitelistEnabled: false };
  }
}

/**
 * Get top blocked IPs for an organization (last 24 hours).
 * @param {object} pool - PostgreSQL connection pool
 * @param {string} orgId - Organization ID
 * @param {number} limit - Number of results
 * @returns {object[]} Array of { ip, count }
 */
export async function getTopBlockedIps(pool, orgId, limit = 10) {
  try {
    const { rows } = await pool.query(
      `SELECT ip_address as ip, COUNT(*)::int as count
       FROM ${S}.ip_whitelist_blocked_attempts
       WHERE org_id = $1 AND attempted_at > NOW() - INTERVAL '24 hours'
       GROUP BY ip_address
       ORDER BY count DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return rows;
  } catch (err) {
    console.error('Error fetching top blocked IPs:', err);
    return [];
  }
}

/**
 * Clear old blocked attempts (for maintenance).
 * @param {object} pool - PostgreSQL connection pool
 * @param {number} olderThanDays - Delete attempts older than this many days
 * @returns {number} Rows deleted
 */
export async function clearOldBlockedAttempts(pool, olderThanDays = 30) {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM ${S}.ip_whitelist_blocked_attempts
       WHERE attempted_at < NOW() - INTERVAL '${olderThanDays} days'`
    );
    return rowCount;
  } catch (err) {
    console.error('Error clearing old blocked attempts:', err);
    return 0;
  }
}
