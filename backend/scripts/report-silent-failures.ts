// @ts-nocheck
/**
 * scripts/report-silent-failures.ts
 * ─────────────────────────────────
 * Lists every remaining silent-failure site so the burn-down is visible and
 * measurable, instead of 40-odd call sites being rewritten blind.
 *
 *   npm run report:silent            # list sites
 *   npm run report:silent -- --ci    # exit 1 if the count grows past BASELINE
 *
 * Two patterns are reported:
 *
 *   1. Swallowed errors — `.catch(() => {})`, `.catch(() => null)`, `catch {}`.
 *      These keep a request alive at the cost of never telling anyone the
 *      operation failed. Against the deployed database this hid four broken
 *      subsystems simultaneously (audit writes, session revocation, alert
 *      creation, API-key auth) while every endpoint returned 200.
 *
 *   2. Leaked internals — handlers responding with a raw `err.message`. The
 *      global error handler in server.ts already returns a safe, classified
 *      body with a correlation id; these bypass it.
 *
 * Fix pattern 1 with `swallow(err, { component, op })` and pattern 2 with
 * `asyncRoute(...)` or `failSafe(res, err, ...)` — both in
 * services/errorHandling.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Ratchet. Lower these as sites are fixed; CI fails if either grows.
// 2026-06-10 first cleanup pass (audit, logout, backup, workspaceRbac): 37 / 145.
// 2026-07-24 second pass: swallow 37→13 (audit-write, RCA enqueue, metric-probe
//   and pool-acquire sites now log via swallow()/swallowWith); leak 145→62
//   (login + user/session/sdk/metrics/otel/observability/status/k8s/retention/
//   aiMonitoring/repo handlers now return a generic body + requestId).
const BASELINE = { swallow: 13, leak: 62 };

const SKIP_DIRS = new Set(['node_modules', 'tests', 'dist', 'generated', '.git']);

const PATTERNS = [
    { kind: 'swallow', label: '.catch(() => {})', re: /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g },
    { kind: 'swallow', label: '.catch(() => null)', re: /\.catch\(\s*\(\s*\)\s*=>\s*null\s*\)/g },
    { kind: 'swallow', label: 'catch {}', re: /catch\s*\{\s*\}/g },
    // Only a RESPONSE carrying the raw message is a leak. Logging it
    // server-side — log('ERROR', msg, { error: err.message }) — is correct and
    // must not be flagged, which an earlier version of this script got wrong.
    {
        kind: 'leak',
        label: 'res.json({ error: err.message })',
        re: /res\s*(?:\.status\([^)]*\))?\s*\.json\(\s*\{[^}]*?(?:error|detail|message)\s*:\s*(?:e|err|error)\.message/g,
    },
];

function walk(dir, acc = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(path.join(dir, entry.name), acc);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            acc.push(path.join(dir, entry.name));
        }
    }
    return acc;
}

const findings = { swallow: [], leak: [] };

for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file);
    if (rel.startsWith('scripts/report-silent-failures')) continue;
    if (rel === 'services/errorHandling.ts') continue; // documents the patterns
    const src = fs.readFileSync(file, 'utf8');
    const lines = src.split('\n');

    for (const { kind, label, re } of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(src)) !== null) {
            const line = src.slice(0, m.index).split('\n').length;
            // A `.catch(err => swallow(...))` on the same line is already fixed.
            if (lines[line - 1]?.includes('swallow(')) continue;
            findings[kind].push({ file: rel, line, label });
        }
    }
}

function report(kind, title, guidance) {
    const items = findings[kind];
    console.log(`\n${title} — ${items.length} site(s)`);
    console.log('─'.repeat(72));
    const byFile = {};
    for (const i of items) (byFile[i.file] ||= []).push(i);
    for (const [file, items] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${String(items.length).padStart(3)}  ${file}`);
        for (const i of items.slice(0, 3)) console.log(`       :${i.line}  ${i.label}`);
        if (items.length > 3) console.log(`       … ${items.length - 3} more`);
    }
    console.log(`\n  → ${guidance}`);
}

report(
    'swallow',
    'SWALLOWED ERRORS',
    'replace with swallow(err, { component, op }) from services/errorHandling.ts',
);
report(
    'leak',
    'LEAKED INTERNAL ERROR MESSAGES',
    'wrap the handler in asyncRoute(), or respond via failSafe(res, err, { component, op })',
);

console.log('\n' + '═'.repeat(72));
console.log(`  swallowed: ${findings.swallow.length} (baseline ${BASELINE.swallow})`);
console.log(`  leaked:    ${findings.leak.length} (baseline ${BASELINE.leak})`);

if (process.argv.includes('--ci')) {
    const regressions = [];
    if (findings.swallow.length > BASELINE.swallow) {
        regressions.push(`swallowed errors ${findings.swallow.length} > ${BASELINE.swallow}`);
    }
    if (findings.leak.length > BASELINE.leak) {
        regressions.push(`leaked messages ${findings.leak.length} > ${BASELINE.leak}`);
    }
    if (regressions.length) {
        console.error(`\n✗ Regression: ${regressions.join('; ')}`);
        console.error('  Use the helpers in services/errorHandling.ts, or lower BASELINE if you fixed some.');
        process.exit(1);
    }
    console.log('\n✓ No regression against baseline.');
}
