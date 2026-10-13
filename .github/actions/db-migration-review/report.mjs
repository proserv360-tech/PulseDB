#!/usr/bin/env node
/**
 * report.mjs
 * ──────────
 * Optionally ship findings to a FATHOM workspace so the audit log has a
 * cross-repo record of every migration reviewed.
 *
 * Requires env:
 *   FATHOM_API_URL     https://fathom.example.com
 *   FATHOM_API_TOKEN   SCIM or service token with governance.audit scope
 */
import fs from 'node:fs';

const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const { FATHOM_API_URL, FATHOM_API_TOKEN } = process.env;
if (!FATHOM_API_URL || !FATHOM_API_TOKEN) {
    console.log('[report] FATHOM_API_URL/TOKEN not set — skipping');
    process.exit(0);
}

const report = JSON.parse(fs.readFileSync(args.findings, 'utf8'));

(async () => {
    try {
        const r = await fetch(`${FATHOM_API_URL.replace(/\/$/, '')}/api/migration-reviews`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${FATHOM_API_TOKEN}`,
            },
            body: JSON.stringify({
                source: 'github-action',
                repo: process.env.GITHUB_REPOSITORY,
                pr: process.env.GITHUB_REF_NAME,
                sha: process.env.GITHUB_SHA,
                report,
            }),
        });
        if (!r.ok) console.log(`[report] FATHOM API ${r.status}: ${await r.text()}`);
        else      console.log('[report] posted to FATHOM API');
    } catch (err) {
        console.log(`[report] failed: ${err.message}`);
    }
})();
