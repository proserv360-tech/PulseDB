// @ts-nocheck
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendations } from '../services/sqlServerAdvisor.js';
import { adviseSqlServer, maskSql } from '../services/sqlServerAiAdvisor.js';

test('missing index becomes a CREATE INDEX script with key and INCLUDE columns', () => {
    const recs = buildRecommendations('storage', {
        missingIndexes: [
            { table_name: '[Sales].[dbo].[Orders]', equality_columns: '[CustomerId]', inequality_columns: '[OrderDate]', included_columns: '[Total]', user_seeks: 5000, avg_user_impact: 91.5 },
            { table_name: '[Sales].[dbo].[Tiny]', equality_columns: '[X]', user_seeks: 3, avg_user_impact: 10 }, // below 25% impact: ignored
        ],
    });
    assert.equal(recs.length, 1);
    assert.equal(recs[0].severity, 'high');
    assert.equal(recs[0].sql, 'CREATE NONCLUSTERED INDEX [IX_Orders_CustomerId_OrderDate]\n    ON [Sales].[dbo].[Orders] ([CustomerId], [OrderDate])\n    INCLUDE ([Total]);');
});

test('identifiers are bracket-escaped in generated scripts', () => {
    const recs = buildRecommendations('security', { databases: [{ database_name: 'we]ird', is_trustworthy_on: 1 }] });
    assert.match(recs[0].sql, /ALTER DATABASE \[we\]\]ird\] SET TRUSTWORTHY OFF;/);
});

test('backups: Express gets no COMPRESSION; FULL recovery without log backups is flagged', () => {
    const recs = buildRecommendations('backups', {
        settings: [{ backup_path: 'D:\\Backups', engine_edition: 4 }],
        backups: [{ database_name: 'Shop', state_desc: 'ONLINE', recovery_model_desc: 'FULL', last_full: null, last_log: null }],
    });
    const full = recs.find((r) => r.id === 'full-backups');
    assert.equal(full.severity, 'high');
    assert.equal(full.sql, "BACKUP DATABASE [Shop] TO DISK = N'D:\\Backups\\Shop_FULL.bak' WITH CHECKSUM, INIT;");
    assert.ok(recs.some((r) => r.id === 'log-backups'));
});

test('maskSql hides string literals before anything is sent to an AI provider', () => {
    assert.equal(maskSql("SELECT * FROM Customers WHERE Email = N'alice@example.com' AND Name = 'O''Brien'"), "SELECT * FROM Customers WHERE Email = '?' AND Name = '?'");
});

test('AI review: clear error when no provider key is configured', async () => {
    const saved = { ...process.env };
    try {
        for (const k of ['COPILOT_PROVIDER', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) delete process.env[k];
        await assert.rejects(adviseSqlServer('storage', { data: {} }), (e) => e.status === 503 && e.code === 'AI_NOT_CONFIGURED');
    } finally {
        process.env = saved;
    }
});

test('AI review: sends findings and masked query text, returns the answer', async () => {
    const saved = { ...process.env };
    const realFetch = globalThis.fetch;
    let sent;
    try {
        delete process.env.COPILOT_PROVIDER;
        process.env.GROQ_API_KEY = 'test-key';
        delete process.env.COPILOT_MODEL;
        globalThis.fetch = async (url, init) => {
            if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'openai/gpt-oss-120b', active: true }] }) };
            sent = { url, body: JSON.parse(init.body) };
            return { ok: true, json: async () => ({ choices: [{ message: { content: '**Summary** all good' } }] }) };
        };
        const r = await adviseSqlServer('performance', { data: { recommendations: [{ severity: 'medium', title: 'Raise cost threshold' }] } }, { kind: 'query', text: "SELECT 1 FROM T WHERE Card = '4111111111111111'", stats: { executions: 9 } });
        assert.equal(r.text, '**Summary** all good');
        assert.equal(r.provider, 'groq');
        assert.match(sent.url, /api\.groq\.com/);
        const userMsg = sent.body.messages.find((m) => m.role === 'user').content;
        assert.ok(!userMsg.includes('4111111111111111'), 'literal must not be sent');
        assert.ok(userMsg.includes("'?'"));
    } finally {
        globalThis.fetch = realFetch;
        process.env = saved;
    }
});

test('Groq: picks an available chat model and recovers when the chosen one is retired', async () => {
    const { pickGroqModel, groqChat, resetGroqModelCache } = await import('../services/copilotService.js');
    resetGroqModelCache();
    assert.equal(pickGroqModel(['whisper-large-v3', 'llama-guard-4-12b', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b']), 'openai/gpt-oss-120b');
    assert.equal(pickGroqModel(['whisper-large-v3', 'llama-3.1-8b-instant']), 'llama-3.1-8b-instant');

    const saved = { ...process.env };
    const realFetch = globalThis.fetch;
    const calls = [];
    let modelList = ['llama-4-maverick-17b-128e-instruct', 'whisper-large-v3'];
    try {
        delete process.env.COPILOT_MODEL;
        globalThis.fetch = async (url, init) => {
            calls.push(url.endsWith('/models') ? 'list' : `chat:${JSON.parse(init.body).model}`);
            if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: modelList.map((id) => ({ id, active: true })) }) };
            const model = JSON.parse(init.body).model;
            if (!modelList.includes(model)) return { ok: false, status: 404, text: async () => '{"error":{"code":"model_not_found"}}' };
            return { ok: true, json: async () => ({ choices: [{ message: { content: `answer from ${model}` } }] }) };
        };
        const first = await groqChat('k', { messages: [{ role: 'user', content: 'hi' }] });
        assert.equal(first.text, 'answer from llama-4-maverick-17b-128e-instruct');
        // Groq retires that model: next call gets 404, re-lists and retries once.
        modelList = ['openai/gpt-oss-120b'];
        const second = await groqChat('k', { messages: [{ role: 'user', content: 'hi' }] });
        assert.equal(second.text, 'answer from openai/gpt-oss-120b');
        assert.deepEqual(calls, ['list', 'chat:llama-4-maverick-17b-128e-instruct', 'chat:llama-4-maverick-17b-128e-instruct', 'list', 'chat:openai/gpt-oss-120b']);
    } finally {
        globalThis.fetch = realFetch;
        process.env = saved;
    }
});
