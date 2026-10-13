// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Server-side proxy to the Groq chat API.
// Extracted from server.ts.

import { authenticate } from '../../core/auth.js';
import { log } from '../../services/logger.js';

export default function registerAiProxyRoutes(app) {
    // ─────────────────────────────────────────────────────────────────────────────
    // AI PROXY (Groq — free tier, OpenAI-compatible, keeps API key server-side)
    // Get a free key at https://console.groq.com → API Keys → Create API Key
    // ─────────────────────────────────────────────────────────────────────────────

    app.post('/api/ai/chat', authenticate, async (req, res) => {
        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) {
            return res.status(503).json({ error: 'AI features not configured.' });
        }
        try {
            const { messages, system, max_tokens } = req.body || {};
            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'messages array is required' });
            }

            // Groq uses the OpenAI chat format.
            // Prepend system prompt as a system-role message if provided.
            const groqMessages = [];
            if (system) groqMessages.push({ role: 'system', content: system });
            messages.forEach((m) => groqMessages.push({ role: m.role, content: m.content }));

            const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: groqMessages,
                    max_tokens: Math.min(max_tokens || 2000, 8000),
                }),
            });
            const data = await upstream.json();
            if (!upstream.ok) {
                return res.status(upstream.status).json({ error: data.error?.message || 'AI request failed' });
            }

            // Normalise to the same shape the frontend already expects: { content: [{ text }] }
            const text = data.choices?.[0]?.message?.content || '';
            res.json({ content: [{ text }] });
        } catch (e) {
            log('WARN', `Handler error ${req.method} ${req.path}`, { error: e.message });
            res.json({});
        }
    });
}
