// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * routes/feedbackRoutes.js
 * ------------------------
 * User feedback endpoints, extracted from server.js (audit M-3, monolith
 * breakup). Self-contained: only depends on the shared pg pool plus the
 * authenticate / requireScreen middleware and a logger, all injected.
 *
 * Mount with:
 *   app.use('/api', feedbackRoutes(pool, authenticate, { requireScreen, log }));
 */

import { Router } from 'express';

// Validate + normalise an incoming feedback payload. Pure function.
export function parseFeedbackBody(body) {
    const {
        feedback_type, rating, comment = '', remarks = '',
        section = 'all', feature_title = '', feature_priority,
        section_feedback, user_metadata = {},
    } = body;
    const type = (feedback_type || 'general').toLowerCase().trim();
    const ALLOWED_TYPES = new Set(['feature', 'bug', 'general']);
    if (!ALLOWED_TYPES.has(type)) return { valid: false, error: `Invalid feedback_type. Must be one of: ${[...ALLOWED_TYPES].join(', ')}` };
    if (type === 'feature') {
        if (!feature_title?.trim()) return { valid: false, error: 'Feature requests require a feature_title' };
        if (!comment.trim())        return { valid: false, error: 'Feature requests require a description in the comment field' };
    } else {
        const hasInline = Array.isArray(section_feedback) && section_feedback.some(s => s.comment?.trim());
        if (!comment.trim() && !hasInline) return { valid: false, error: 'A comment is required' };
    }
    let parsedRating = null;
    if (rating !== null && rating !== undefined && rating !== '') {
        parsedRating = Number(rating);
        if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5)
            return { valid: false, error: 'Rating must be an integer between 1 and 5' };
    }
    const cap = (str, max) => String(str || '').trim().slice(0, max);
    return {
        valid: true,
        fields: {
            type, rating: parsedRating,
            comment:          cap(comment, 2000),
            remarks:          cap(remarks, 2000),
            section:          cap(section, 100),
            feature_title:    cap(feature_title, 120),
            feature_priority: ['Low','Medium','High'].includes(feature_priority) ? feature_priority : null,
            section_feedback: Array.isArray(section_feedback) ? section_feedback : null,
            user_metadata,
        },
    };
}

export default function feedbackRoutes(pool, authenticate, { requireScreen, log } = {}) {
    const router = Router();
    const warn = (req, e) =>
        log?.('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });

    router.post('/feedback', authenticate, async (req, res) => {
        try {
            const parsed = parseFeedbackBody(req.body);
            if (!parsed.valid) return res.status(400).json({ error: parsed.error });
            const { type, rating, comment, remarks, section, feature_title, feature_priority, user_metadata } = parsed.fields;
            const result = await pool.query(
                `INSERT INTO pgmonitoringtool.user_feedback
                 (username, feedback_type, rating, comment, remarks, section, feature_title, feature_priority, status, user_metadata)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new',$9) RETURNING id, created_at`,
                [req.user.username, type, rating, comment, remarks || null, section, feature_title || null,
                    feature_priority || null, JSON.stringify(user_metadata)]
            );
            res.status(201).json({ success: true, feedbackId: result.rows[0].id, created_at: result.rows[0].created_at });
        } catch (e) { res.status(500).json({ error: 'Failed to submit feedback' }); }
    });

    router.get('/feedback/mine', authenticate, async (req, res) => {
        const limit  = Math.min(parseInt(req.query.limit, 10)  || 20, 100);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);
        try {
            const result = await pool.query(
                `SELECT id, feedback_type, rating, comment, remarks, section, feature_title, feature_priority, status, created_at
                 FROM pgmonitoringtool.user_feedback WHERE username = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
                [req.user.username, limit, offset]
            );
            res.json({ rows: result.rows, limit, offset });
        } catch (e) {
            warn(req, e);
            res.json({ rows: [], limit, offset });
        }
    });

    router.get('/admin/feedback', authenticate, requireScreen('admin'), async (req, res) => {
        const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);
        try {
            const conditions = []; const params = [];
            if (req.query.type)     { params.push(req.query.type);            conditions.push(`feedback_type = $${params.length}`); }
            if (req.query.status)   { params.push(req.query.status);          conditions.push(`status = $${params.length}`); }
            if (req.query.section)  { params.push(req.query.section);         conditions.push(`section = $${params.length}`); }
            if (req.query.username) { params.push(`%${req.query.username}%`); conditions.push(`username ILIKE $${params.length}`); }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            params.push(limit, offset);
            const [rows, countRow] = await Promise.all([
                pool.query(`SELECT id,username,feedback_type,rating,comment,remarks,section,feature_title,feature_priority,status,created_at,user_metadata FROM pgmonitoringtool.user_feedback ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params),
                pool.query(`SELECT COUNT(*) AS total FROM pgmonitoringtool.user_feedback ${where}`, params.slice(0,-2)),
            ]);
            res.json({ rows: rows.rows, total: parseInt(countRow.rows[0].total), limit, offset });
        } catch (e) {
            warn(req, e);
            res.json({ rows: [], total: 0, limit, offset });
        }
    });

    router.patch('/admin/feedback/:id/status', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const ALLOWED = ['new','reviewed','implemented','rejected'];
            if (!ALLOWED.includes(req.body.status)) return res.status(400).json({ error: `Status must be one of: ${ALLOWED.join(', ')}` });
            const result = await pool.query(
                `UPDATE pgmonitoringtool.user_feedback SET status=$1 WHERE id=$2 RETURNING id,status`,
                [req.body.status, parseInt(req.params.id, 10)]
            );
            if (!result.rowCount) return res.status(404).json({ error: 'Feedback not found' });
            res.json({ success: true, ...result.rows[0] });
        } catch (e) {
            log?.('ERROR', 'Update feedback error', { error: e.message });
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    router.get('/admin/feedback/summary', authenticate, requireScreen('admin'), async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status='new')         AS new_count,
                    COUNT(*) FILTER (WHERE status='reviewed')    AS reviewed_count,
                    COUNT(*) FILTER (WHERE status='implemented') AS implemented_count,
                    ROUND(AVG(rating) FILTER (WHERE rating IS NOT NULL),2) AS avg_rating,
                    COUNT(*) FILTER (WHERE feedback_type='bug')     AS bug_count,
                    COUNT(*) FILTER (WHERE feedback_type='feature') AS feature_count,
                    COUNT(*) FILTER (WHERE feedback_type='general') AS general_count,
                    COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '7 days') AS last_7_days
                FROM pgmonitoringtool.user_feedback
            `);
            res.json(result.rows[0]);
        } catch (e) {
            warn(req, e);
            res.json({});
        }
    });

    return router;
}
