// @ts-nocheck
import { Router } from 'express';

export default function adminRoutes(authenticate, cached, CONFIG, reqPool, cache, log) {
    const router = Router();

    router.get('/admin/settings', authenticate, cached('admin:settings', CONFIG.CACHE_TTL.SETTINGS), async (req, res) => {
        try {
            const r = await (await reqPool(req)).query(
                "SELECT name, setting, unit, context FROM pg_settings WHERE name IN ('max_connections','shared_buffers','work_mem','maintenance_work_mem','effective_cache_size','wal_level','checkpoint_completion_target') ORDER BY name",
            );
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/admin/extensions', authenticate, cached('admin:ext', CONFIG.CACHE_TTL.EXTENSIONS), async (req, res) => {
        try {
            const r = await (await reqPool(req)).query('SELECT extname AS name, extversion AS version FROM pg_extension');
            res.json(r.rows);
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json([]);
        }
    });

    router.get('/admin/cache/stats', authenticate, (req, res) => res.json(cache.stats()));

    router.post('/admin/cache/clear', authenticate, (req, res) => {
        cache.clear();
        res.json({ success: true });
    });

    return router;
}
