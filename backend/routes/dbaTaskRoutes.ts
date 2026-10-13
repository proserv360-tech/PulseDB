// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/dbaTaskRoutes.js
 * -----------------------
 * DBA Task Scheduler endpoints, extracted from server.js (audit M-3, the first
 * step of breaking up the ~6.9k-line monolith). Backed by Postgres via
 * services/dbaTaskService.js (audit M-2).
 *
 * Mount with:
 *   app.use('/api', dbaTaskRoutes(pool, authenticate, { requireScreen, log }));
 */

import { Router } from 'express';
import * as dbaTasks from '../services/dbaTaskService.js';

export default function dbaTaskRoutes(pool, authenticate, { requireScreen, log } = {}) {
    const router = Router();
    const warn = (req, e) =>
        log?.('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });

    router.get('/tasks', authenticate, async (req, res) => {
        try {
            res.json(await dbaTasks.listTasks(pool));
        } catch (e) {
            warn(req, e);
            res.status(500).json({ error: 'Failed to load tasks' });
        }
    });

    router.post('/tasks', authenticate, async (req, res) => {
        try {
            const { title } = req.body;
            if (!title?.trim()) return res.status(400).json({ error: 'title required' });
            res.status(201).json(await dbaTasks.createTask(pool, req.body));
        } catch (e) {
            warn(req, e);
            res.status(500).json({ error: 'Failed to create task' });
        }
    });

    router.patch('/tasks/:id', authenticate, async (req, res) => {
        try {
            const updated = await dbaTasks.updateTask(pool, req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: 'not found' });
            res.json(updated);
        } catch (e) {
            warn(req, e);
            res.status(500).json({ error: 'Failed to update task' });
        }
    });

    router.delete('/tasks/:id', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const ok = await dbaTasks.deleteTask(pool, req.params.id);
            if (!ok) return res.status(404).json({ error: 'not found' });
            res.json({ ok: true });
        } catch (e) {
            warn(req, e);
            res.status(500).json({ error: 'Failed to delete task' });
        }
    });

    router.post('/tasks/reset', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const count = await dbaTasks.resetTasks(pool);
            res.json({ ok: true, count });
        } catch (e) {
            warn(req, e);
            res.status(500).json({ error: 'Failed to reset tasks' });
        }
    });

    return router;
}
