// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/statusPageService.js
 * ─────────────────────────────
 * Public status page service.
 * Tracks uptime, incidents, and provides sanitized public health status.
 */

const S = 'pgmonitoringtool';

function log(level, message, meta = {}) {
    const entry = { ts: new Date().toISOString(), level, msg: message, ...meta };
    const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

/**
 * Get sanitized public health status.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   status: 'operational'|'degraded'|'down',
 *   statusColor: 'green'|'yellow'|'red',
 *   responseTimeMs: number,
 *   uptime: number,
 *   lastChecked: Date
 * }>}
 */
export async function getPublicStatus(pool) {
    try {
        const startTime = Date.now();

        // Perform health check
        const healthRes = await pool.query('SELECT NOW()');
        const responseTime = Date.now() - startTime;

        // Get uptime from last 24 hours
        const uptimeRes = await pool.query(
            `SELECT ROUND(AVG(CAST(data->>'uptime_percent' AS numeric)), 2) as avg_uptime
             FROM   ${S}.status_checks
             WHERE  created_at >= NOW() - INTERVAL '24 hours'`
        );

        const uptime = uptimeRes.rows[0]?.avg_uptime || 100;

        // Determine status
        let status = 'operational';
        if (uptime < 99) {
            status = 'degraded';
        }
        if (uptime < 95 || responseTime > 5000) {
            status = 'down';
        }

        const statusColor = status === 'operational' ? 'green' : status === 'degraded' ? 'yellow' : 'red';

        return {
            status,
            statusColor,
            responseTimeMs: responseTime,
            uptime: parseFloat(uptime),
            lastChecked: new Date(),
        };
    } catch (err) {
        log('WARN', 'Health check failed', { error: err.message });
        return {
            status: 'down',
            statusColor: 'red',
            responseTimeMs: 0,
            uptime: 0,
            lastChecked: new Date(),
        };
    }
}

/**
 * Get daily uptime percentages for past N days.
 * @param {import('pg').Pool} pool
 * @param {number} days
 * @returns {Promise<Array<{date: string, uptimePercent: number}>>}
 */
export async function getUptimeHistory(pool, days = 30) {
    if (days <= 0) {
        throw new Error('days must be positive');
    }

    try {
        const res = await pool.query(
            `SELECT
                DATE(created_at) as date,
                ROUND(AVG(CAST(data->>'uptime_percent' AS numeric)), 2) as uptime_percent
             FROM   ${S}.status_checks
             WHERE  created_at >= NOW() - INTERVAL '1 day' * $1
             GROUP  BY DATE(created_at)
             ORDER  BY date DESC`,
            [days]
        );

        return res.rows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            uptimePercent: parseFloat(row.uptime_percent),
        }));
    } catch (err) {
        log('WARN', 'Failed to get uptime history', { error: err.message });
        return [];
    }
}

/**
 * List recent incidents/outages.
 * @param {import('pg').Pool} pool
 * @param {number} limit
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   severity: 'info'|'warning'|'critical',
 *   status: 'investigating'|'identified'|'monitoring'|'resolved',
 *   createdAt: Date,
 *   resolvedAt?: Date
 * }>>}
 */
export async function getIncidents(pool, limit = 10) {
    try {
        const res = await pool.query(
            `SELECT id, title, description, severity, status, created_at, resolved_at
             FROM   ${S}.incidents
             ORDER  BY created_at DESC
             LIMIT  $1`,
            [limit]
        );

        return res.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            severity: row.severity,
            status: row.status,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at,
        }));
    } catch (err) {
        log('WARN', 'Failed to get incidents', { error: err.message });
        return [];
    }
}

/**
 * Create a new incident.
 * @param {import('pg').Pool} pool
 * @param {{
 *   title: string,
 *   description: string,
 *   severity: 'info'|'warning'|'critical',
 *   status?: 'investigating'|'identified'|'monitoring'|'resolved'
 * }} incident
 * @returns {Promise<string>} Incident ID
 */
export async function createIncident(pool, incident) {
    const { title, description, severity, status = 'investigating' } = incident;

    if (!title || !description || !severity) {
        throw new Error('title, description, and severity are required');
    }

    if (!['info', 'warning', 'critical'].includes(severity)) {
        throw new Error('severity must be info, warning, or critical');
    }

    const res = await pool.query(
        `INSERT INTO ${S}.incidents (title, description, severity, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [title, description, severity, status]
    );

    const incidentId = res.rows[0].id;
    log('INFO', 'Incident created', { incidentId, severity });

    return incidentId;
}

/**
 * Update an existing incident.
 * @param {import('pg').Pool} pool
 * @param {string} incidentId
 * @param {{title?: string, description?: string, status?: string}} updates
 * @returns {Promise<void>}
 */
export async function updateIncident(pool, incidentId, updates) {
    if (!incidentId) {
        throw new Error('incidentId is required');
    }

    const { title, description, status } = updates;

    const setClauses = [];
    const params = [];

    if (title !== undefined) {
        params.push(title);
        setClauses.push(`title = $${params.length}`);
    }
    if (description !== undefined) {
        params.push(description);
        setClauses.push(`description = $${params.length}`);
    }
    if (status !== undefined) {
        params.push(status);
        setClauses.push(`status = $${params.length}`);
    }

    if (setClauses.length === 0) {
        return; // No updates
    }

    params.push(incidentId);
    const setClause = setClauses.join(', ');

    await pool.query(
        `UPDATE ${S}.incidents
         SET ${setClause}, updated_at = NOW()
         WHERE id = $${params.length}`,
        params
    );

    log('INFO', 'Incident updated', { incidentId });
}

/**
 * Mark an incident as resolved.
 * @param {import('pg').Pool} pool
 * @param {string} incidentId
 * @returns {Promise<void>}
 */
export async function resolveIncident(pool, incidentId) {
    if (!incidentId) {
        throw new Error('incidentId is required');
    }

    await pool.query(
        `UPDATE ${S}.incidents
         SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [incidentId]
    );

    log('INFO', 'Incident resolved', { incidentId });
}

/**
 * Get overall status summary with component breakdown.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{
 *   overallStatus: 'operational'|'degraded'|'down',
 *   components: Array<{name: string, status: string, uptime: number}>,
 *   lastIncident?: {title: string, severity: string},
 *   uptimePercent: number
 * }>}
 */
export async function getStatusSummary(pool) {
    try {
        const publicStatus = await getPublicStatus(pool);

        // Get last incident
        const incidentRes = await pool.query(
            `SELECT title, severity FROM ${S}.incidents
             WHERE status != 'resolved'
             ORDER BY created_at DESC
             LIMIT 1`
        );

        const lastIncident = incidentRes.rows[0] || null;

        // Component status (we track PostgreSQL as main component)
        const components = [
            {
                name: 'Database (PostgreSQL)',
                status: publicStatus.status,
                uptime: publicStatus.uptime,
            },
        ];

        // Get 24h uptime
        const uptimeRes = await pool.query(
            `SELECT ROUND(AVG(CAST(data->>'uptime_percent' AS numeric)), 2) as avg_uptime
             FROM   ${S}.status_checks
             WHERE  created_at >= NOW() - INTERVAL '24 hours'`
        );

        const uptimePercent = parseFloat(uptimeRes.rows[0]?.avg_uptime || 100);

        return {
            overallStatus: publicStatus.status,
            components,
            lastIncident,
            uptimePercent,
        };
    } catch (err) {
        log('ERROR', 'Failed to get status summary', { error: err.message });
        throw err;
    }
}
