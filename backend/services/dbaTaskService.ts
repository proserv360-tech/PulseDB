// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/dbaTaskService.js
 * --------------------------
 * Postgres-backed store for the DBA Task Scheduler (audit M-2).
 *
 * Replaces the previous in-memory Map, which lost all state between Vercel
 * serverless invocations and wasn't shared across instances. Every operation
 * reads/writes pgmonitoringtool.dba_tasks (migration 0021).
 *
 * The default task list is seeded lazily: the first list() against an empty
 * table inserts the defaults, so a fresh database "just works" without a
 * separate seed step.
 */

const S = 'pgmonitoringtool';

export const DEFAULT_TASKS = [
    { category: 'Daily',   priority: 'high',   title: 'Check active connections and long-running queries',  recurrence: 'daily'   },
    { category: 'Daily',   priority: 'high',   title: 'Review autovacuum activity and dead tuple counts',   recurrence: 'daily'   },
    { category: 'Daily',   priority: 'medium', title: 'Check replication lag on all standby servers',       recurrence: 'daily'   },
    { category: 'Daily',   priority: 'medium', title: 'Verify backup job completed successfully',            recurrence: 'daily'   },
    { category: 'Daily',   priority: 'low',    title: 'Review pg_stat_bgwriter checkpoint ratios',          recurrence: 'daily'   },
    { category: 'Weekly',  priority: 'high',   title: 'Analyze table bloat and schedule VACUUM FULL',       recurrence: 'weekly'  },
    { category: 'Weekly',  priority: 'high',   title: 'Review slow query log and optimize top offenders',   recurrence: 'weekly'  },
    { category: 'Weekly',  priority: 'medium', title: 'Check index usage and remove unused indexes',        recurrence: 'weekly'  },
    { category: 'Weekly',  priority: 'medium', title: 'Update table statistics with ANALYZE on large tables', recurrence: 'weekly' },
    { category: 'Monthly', priority: 'high',   title: 'Review and rotate PostgreSQL logs',                  recurrence: 'monthly' },
    { category: 'Monthly', priority: 'high',   title: 'Audit user roles and permissions',                   recurrence: 'monthly' },
    { category: 'Monthly', priority: 'medium', title: 'Capacity planning: review disk, CPU, memory trends', recurrence: 'monthly' },
    { category: 'Monthly', priority: 'low',    title: 'Test backup restoration procedure',                   recurrence: 'monthly' },
];

// Map a DB row (snake_case) to the API shape (camelCase) the frontend expects.
function toClient(row) {
    return {
        id:          String(row.id),
        title:       row.title,
        category:    row.category,
        priority:    row.priority,
        recurrence:  row.recurrence,
        notes:       row.notes ?? '',
        dueDate:     row.due_date,
        assignee:    row.assignee ?? '',
        done:        row.done,
        createdAt:   row.created_at,
        completedAt: row.completed_at,
    };
}

async function seedDefaults(pool) {
    // Insert defaults in one statement; marked is_default so a reset knows them.
    const values = [];
    const params = [];
    DEFAULT_TASKS.forEach((t, i) => {
        const b = i * 4;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, TRUE)`);
        params.push(t.title, t.category, t.priority, t.recurrence);
    });
    await pool.query(
        `INSERT INTO ${S}.dba_tasks (title, category, priority, recurrence, is_default) VALUES ${values.join(', ')}`,
        params,
    );
}

export async function listTasks(pool) {
    const { rows } = await pool.query(`SELECT * FROM ${S}.dba_tasks ORDER BY id`);
    if (rows.length === 0) {
        await seedDefaults(pool);
        const seeded = await pool.query(`SELECT * FROM ${S}.dba_tasks ORDER BY id`);
        return seeded.rows.map(toClient);
    }
    return rows.map(toClient);
}

export async function createTask(pool, input) {
    const {
        title, category = 'Daily', priority = 'medium', recurrence = 'daily',
        notes = '', dueDate = null, assignee = '',
    } = input;
    const { rows } = await pool.query(
        `INSERT INTO ${S}.dba_tasks (title, category, priority, recurrence, notes, due_date, assignee)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [title.trim(), category, priority, recurrence, notes, dueDate, assignee],
    );
    return toClient(rows[0]);
}

export async function updateTask(pool, id, updates) {
    // Whitelist updatable columns; compute completed_at from `done` transitions.
    const colMap = {
        title: 'title', category: 'category', priority: 'priority',
        recurrence: 'recurrence', notes: 'notes', dueDate: 'due_date',
        assignee: 'assignee', done: 'done',
    };
    const sets = [];
    const params = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
        if (k in updates) { sets.push(`${col} = $${i++}`); params.push(updates[k]); }
    }
    if ('done' in updates) {
        sets.push(updates.done ? `completed_at = COALESCE(completed_at, NOW())` : `completed_at = NULL`);
    }
    if (sets.length === 0) {
        const { rows } = await pool.query(`SELECT * FROM ${S}.dba_tasks WHERE id = $1`, [id]);
        return rows[0] ? toClient(rows[0]) : null;
    }
    params.push(id);
    const { rows } = await pool.query(
        `UPDATE ${S}.dba_tasks SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        params,
    );
    return rows[0] ? toClient(rows[0]) : null;
}

export async function deleteTask(pool, id) {
    const { rowCount } = await pool.query(`DELETE FROM ${S}.dba_tasks WHERE id = $1`, [id]);
    return rowCount > 0;
}

export async function resetTasks(pool) {
    await pool.query(`DELETE FROM ${S}.dba_tasks`);
    await seedDefaults(pool);
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${S}.dba_tasks`);
    return rows[0].n;
}
