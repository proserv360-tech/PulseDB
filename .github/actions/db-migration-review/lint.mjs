#!/usr/bin/env node
/**
 * lint.mjs
 * ────────
 * FATHOM migration linter. Reads a list of .sql files, classifies every
 * statement, and emits a JSON report with findings at levels:
 *   info    — harmless
 *   warn    — review recommended
 *   error   — likely to lock tables, drop data, or break replicas
 *
 * Rules are tuned for PostgreSQL by default with MySQL/Mongo toggles.
 *
 * Intentionally dependency-free: runs anywhere Node 18+ runs.
 */
import fs from 'node:fs';
import path from 'node:path';

// ── arg parsing (no deps) ────────────────────────────────────────────────────
const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const engine = (args.engine || 'postgres').toLowerCase();
const out    = args.out || '/tmp/findings.json';
const list   = args.targets || '/tmp/targets.txt';

const files = fs.readFileSync(list, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

// ── rules ────────────────────────────────────────────────────────────────────
// Each rule takes a single statement and an engine. Returns null or a finding.
const RULES = [
    // DROP TABLE — destructive
    {
        id: 'destructive-drop',
        engines: ['postgres', 'mysql'],
        test: s => /\bdrop\s+(table|database|schema)\b/i.test(s) && !/if\s+exists/i.test(s),
        level: 'error',
        message: 'Destructive DROP without IF EXISTS. Migrations must be idempotent.',
        fix:     'Add IF EXISTS, or split into a soft-delete first (rename) then a later cleanup migration.',
    },
    // DROP COLUMN on Postgres — requires AccessExclusiveLock; dangerous on big tables
    {
        id: 'drop-column',
        engines: ['postgres', 'mysql'],
        test: s => /\balter\s+table\b[\s\S]+\bdrop\s+column\b/i.test(s),
        level: 'warn',
        message: 'DROP COLUMN takes AccessExclusiveLock. Can stall traffic on a large table.',
        fix:     'Use a two-phase rollout: stop writing to column in app, ship, then drop in a low-traffic window.',
    },
    // Non-concurrent index build
    {
        id: 'non-concurrent-index',
        engines: ['postgres'],
        test: s => /\bcreate\s+(unique\s+)?index\b/i.test(s) && !/\bconcurrently\b/i.test(s),
        level: 'error',
        message: 'CREATE INDEX without CONCURRENTLY locks writes on the table.',
        fix:     'Use CREATE INDEX CONCURRENTLY (cannot be inside a transaction block).',
    },
    // Transactional CREATE INDEX CONCURRENTLY
    {
        id: 'concurrent-in-tx',
        engines: ['postgres'],
        test: s => /\bcreate\s+(unique\s+)?index\s+concurrently\b/i.test(s),
        level: 'info',
        message: 'CREATE INDEX CONCURRENTLY detected. Ensure the migration runner does NOT wrap it in a transaction.',
    },
    // ALTER … SET NOT NULL — requires full table scan / lock
    {
        id: 'set-not-null',
        engines: ['postgres'],
        test: s => /\balter\s+table\b[\s\S]+\bset\s+not\s+null\b/i.test(s),
        level: 'warn',
        message: 'SET NOT NULL requires a full-table scan and AccessExclusiveLock.',
        fix:     'Backfill, add a CHECK … NOT VALID, VALIDATE CONSTRAINT, then SET NOT NULL (PG12+ shortcut).',
    },
    // ALTER TYPE — expensive rewrite
    {
        id: 'type-change',
        engines: ['postgres', 'mysql'],
        test: s => /\balter\s+table\b[\s\S]+\balter\s+(column\s+\w+\s+)?type\b/i.test(s)
                || /\bmodify\s+column\b/i.test(s),
        level: 'warn',
        message: 'Column type change may rewrite the table.',
        fix:     'Add a new column, backfill, swap, then drop — spread across deploys.',
    },
    // ADD COLUMN … NOT NULL DEFAULT — PG11+ is metadata-only but only if default is immutable
    {
        id: 'add-column-default',
        engines: ['postgres'],
        test: s => /\badd\s+column\b[\s\S]+\bnot\s+null\b[\s\S]+\bdefault\b/i.test(s),
        level: 'warn',
        message: 'ADD COLUMN NOT NULL DEFAULT is metadata-only on PG11+ *only* with an immutable default.',
        fix:     'Avoid volatile defaults like now(). If used, split: add nullable, backfill, set NOT NULL.',
    },
    // TRUNCATE in migration
    {
        id: 'truncate',
        engines: ['postgres', 'mysql'],
        test: s => /\btruncate\b/i.test(s),
        level: 'error',
        message: 'TRUNCATE in a migration will wipe data in production.',
        fix:     'Never truncate from a migration. Use a dedicated, reviewed admin job.',
    },
    // GRANT / REVOKE — often missing in staging but shipping to prod
    {
        id: 'grant-revoke',
        engines: ['postgres', 'mysql'],
        test: s => /\b(grant|revoke)\b/i.test(s),
        level: 'info',
        message: 'Privilege change detected. Confirm it is applied consistently across environments.',
    },
    // Mongo — dropCollection / dropDatabase
    {
        id: 'mongo-drop',
        engines: ['mongo'],
        test: s => /\b(dropCollection|dropDatabase)\b/.test(s),
        level: 'error',
        message: 'Destructive Mongo drop detected.',
        fix:     'Move destructive drops into a separate, out-of-band cleanup operation.',
    },
];

// ── statement splitter ──────────────────────────────────────────────────────
function splitSql(content) {
    // Naive splitter — good enough for migration linting. Respects:
    //   • single-quoted strings
    //   • double-quoted identifiers
    //   • single-line (-- …) and block (/* … */) comments
    //   • dollar-quoted strings  $tag$ … $tag$
    const stmts = [];
    let buf = '';
    let i = 0;
    while (i < content.length) {
        const c = content[i];
        const next = content[i + 1];
        // line comment
        if (c === '-' && next === '-') {
            while (i < content.length && content[i] !== '\n') { buf += content[i++]; }
            continue;
        }
        // block comment
        if (c === '/' && next === '*') {
            buf += c; buf += next; i += 2;
            while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) { buf += content[i++]; }
            if (i < content.length) { buf += '*/'; i += 2; }
            continue;
        }
        // dollar quote
        if (c === '$') {
            const m = /^\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(content.slice(i));
            if (m) {
                const tag = m[0];
                buf += tag; i += tag.length;
                const end = content.indexOf(tag, i);
                if (end < 0) {
                    // MED-7: unterminated dollar-quoted body. Emit a warning to
                    // stderr so the CI log surfaces it — the remainder is swept
                    // into the current statement so we don't silently drop SQL.
                    console.error(
                        `::warning::unterminated dollar-quoted string (tag ${tag}); ` +
                        `file may be truncated or tag mismatched. Remainder treated as one statement.`
                    );
                    buf += content.slice(i);
                    i = content.length;
                } else {
                    buf += content.slice(i, end + tag.length);
                    i = end + tag.length;
                }
                continue;
            }
        }
        // single-quoted string
        if (c === "'") {
            buf += c; i++;
            while (i < content.length) {
                if (content[i] === "'" && content[i + 1] === "'") { buf += "''"; i += 2; continue; }
                buf += content[i];
                if (content[i] === "'") { i++; break; }
                i++;
            }
            continue;
        }
        // double-quoted identifier
        if (c === '"') {
            buf += c; i++;
            while (i < content.length && content[i] !== '"') buf += content[i++];
            if (i < content.length) { buf += '"'; i++; }
            continue;
        }
        // statement terminator
        if (c === ';') {
            const trimmed = buf.trim();
            if (trimmed) stmts.push(trimmed);
            buf = '';
            i++;
            continue;
        }
        buf += c;
        i++;
    }
    const tail = buf.trim();
    if (tail) stmts.push(tail);
    return stmts;
}

// ── main ────────────────────────────────────────────────────────────────────
const findings = [];
for (const rel of files) {
    let content;
    try { content = fs.readFileSync(rel, 'utf8'); }
    catch { continue; }
    const stmts = splitSql(content);
    stmts.forEach((stmt, idx) => {
        for (const rule of RULES) {
            if (!rule.engines.includes(engine)) continue;
            if (!rule.test(stmt)) continue;
            findings.push({
                file: rel,
                statementIndex: idx,
                ruleId: rule.id,
                level: rule.level,
                message: rule.message,
                fix: rule.fix || null,
                snippet: stmt.length > 280 ? stmt.slice(0, 280) + ' …' : stmt,
            });
        }
    });
}

const counts = findings.reduce((m, f) => { m[f.level] = (m[f.level] || 0) + 1; return m; }, {});
const report = {
    engine,
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    counts,
    findings,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));

// summary to stdout / actions log
const { error = 0, warn = 0, info = 0 } = counts;
console.log(`FATHOM migration review: ${error} error, ${warn} warn, ${info} info across ${files.length} files.`);
for (const f of findings) {
    const lvl = f.level.toUpperCase();
    console.log(`::${f.level === 'error' ? 'error' : 'warning'} file=${f.file}::${lvl} [${f.ruleId}] ${f.message}`);
}
