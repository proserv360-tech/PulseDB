#!/usr/bin/env node
/**
 * report.mjs
 * ──────────
 * Optionally ship findings to a PulseDB workspace so the audit log has a
 * cross-repo record of every migration reviewed.
 *
 * Requires env:
 *   PULSEDB_API_URL     https://pulsedb.example.com
 *   PULSEDB_API_TOKEN   SCIM or service token with governance.audit scope
 */
import fs from 'node:fs';

const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const { PULSEDB_API_URL, PULSEDB_API_TOKEN } = process.env;
if (!PULSEDB_API_URL || !PULSEDB_API_TOKEN) {
    console.log('[report] PULSEDB_API_URL/TOKEN not set — skipping');
    process.exit(0);
}

const report = JSON.parse(fs.readFileSync(args.findings, 'utf8'));

(async () => {
    try {
        const r = await fetch(`${PULSEDB_API_URL.replace(/\/$/, '')}/api/migration-reviews`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${PULSEDB_API_TOKEN}`,
            },
            body: JSON.stringify({
                source: 'github-action',
                repo: process.env.GITHUB_REPOSITORY,
                pr: process.env.GITHUB_REF_NAME,
                sha: process.env.GITHUB_SHA,
                report,
            }),
        });
        if (!r.ok) console.log(`[report] PulseDB API ${r.status}: ${await r.text()}`);
        else      console.log('[report] posted to PulseDB API');
    } catch (err) {
        console.log(`[report] failed: ${err.message}`);
    }
})();
