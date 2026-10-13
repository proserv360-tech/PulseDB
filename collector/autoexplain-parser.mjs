/**
 * autoexplain-parser.mjs
 *
 * Shared parser for RDS PostgreSQL `auto_explain` log lines (log_format=json).
 * Imported by both the polling shipper (pulsedb-autoexplain-shipper.mjs) and the
 * push-based Lambda (lambda/autoexplain-lambda.mjs) so the parsing logic lives
 * in exactly one place.
 *
 * parseAutoExplainMessage(message, eventTimestampMs, opts?) -> event | null
 *   where `event` matches the /api/auto-explain/ingest contract:
 *     { capturedAt, durationMs, statement, queryId, databaseName,
 *       userName, application, planJson, source }
 */

export function parseAutoExplainMessage(message, eventTimestampMs, opts = {}) {
    if (!message || message.indexOf('{') === -1) return null;
    // auto_explain plans contain "duration:" and a JSON "Plan" object.
    if (!/duration:/i.test(message) && !/"Plan"/.test(message)) return null;

    const jsonStart = message.indexOf('{');
    const jsonText = extractBalancedJson(message.slice(jsonStart));
    if (!jsonText) return null;

    let doc;
    try {
        doc = JSON.parse(jsonText);
    } catch {
        return null;
    }

    // auto_explain JSON output puts the tree under "Plan"; some versions emit a
    // bare plan node. Accept both shapes and normalize to { Plan: ... }.
    const planRoot = doc.Plan ? doc : doc.Plans || doc['Node Type'] ? { Plan: doc } : null;
    if (!planRoot || !planRoot.Plan) return null;

    const durMatch = /duration:\s*([\d.]+)\s*ms/i.exec(message);
    const durationMs = durMatch ? Number(durMatch[1]) : numericTotalTime(planRoot.Plan);

    const statement =
        typeof doc['Query Text'] === 'string' && doc['Query Text'].trim()
            ? doc['Query Text']
            : extractStatementFromLog(message);

    return {
        capturedAt: new Date(eventTimestampMs).toISOString(),
        durationMs: durationMs != null ? Number(durationMs) : null,
        statement: (statement || '(unknown)').slice(0, 50_000),
        queryId: numericOrNull(doc['Query Identifier'] ?? doc.queryId),
        // Support both explicit prefixes (db=.. user=.. app=..) and the common
        // RDS "user@db" log_line_prefix form.
        databaseName: matchPrefix(message, /db=([^\s,]+)/) || matchPrefix(message, /[:@]\w+@(\w+)/) || null,
        userName: matchPrefix(message, /user=([^\s,]+)/) || matchPrefix(message, /:(\w+)@\w+:/) || null,
        application: matchPrefix(message, /app=([^\s,]+)/) || null,
        planJson: planRoot,
        source: { provider: opts.provider || 'rds-cloudwatch', logGroup: opts.logGroup || null },
    };
}

function extractBalancedJson(s) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return s.slice(0, i + 1);
        }
    }
    return null;
}
function numericTotalTime(plan) {
    const v = plan && plan['Actual Total Time'];
    return typeof v === 'number' ? v : null;
}
function numericOrNull(v) {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function matchPrefix(message, re) {
    const m = re.exec(message);
    return m ? m[1] : null;
}
function extractStatementFromLog(message) {
    const m = /statement:\s*([\s\S]+)$/i.exec(message);
    return m ? m[1].trim().slice(0, 50_000) : null;
}
