#!/usr/bin/env node
/**
 * comment.mjs
 * ───────────
 * Post (or update) a single consolidated PR comment with the findings from
 * lint.mjs. Idempotent: looks for a previous FATHOM comment (marker in body)
 * and edits it in place so repeated runs don't spam the PR.
 *
 * Requires GH_TOKEN in env (provided by the action).
 *
 * LOW-9 (audit): previously the script had two code paths — a `gh` CLI
 * branch and a direct-fetch branch — each with its own `try/catch` around
 * both the list-comments and update/create calls. That's four places a
 * shell invocation can surprise us. `gh` is only available on GitHub-hosted
 * runners anyway, and when it is, `gh api` is just a curl to
 * api.github.com with the same token we already have in GH_TOKEN. We
 * collapse everything to a single `apiFetch()` path and drop the child
 * process dependency entirely, which also removes a command-injection
 * surface (body content was being passed as `-f body=…` to `gh`).
 */
import fs from 'node:fs';

const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, '').split('='))
);
const findingsPath = args.findings;
const repo = args.repo;
const pr = Number(args.pr);

if (!findingsPath || !repo || !pr) {
    console.log('[comment] missing args — skipping');
    process.exit(0);
}

const report = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
const MARKER = '<!-- fathom-db-migration-review -->';

function render() {
    const { counts = {}, findings = [], engine, fileCount } = report;
    const { error = 0, warn = 0, info = 0 } = counts;
    const head = [
        MARKER,
        '### FATHOM DB Migration Review',
        '',
        `Engine: **${engine}** · Files scanned: **${fileCount}** · Findings: **${error} error**, **${warn} warn**, **${info} info**`,
        '',
    ];
    if (!findings.length) {
        head.push('No issues detected. ');
        head.push('');
        head.push('<sub>_FATHOM migration linter — `fathom db-migration-review` action_</sub>');
        return head.join('\n');
    }
    const rows = ['| Level | Rule | File | Suggestion |', '|---|---|---|---|'];
    for (const f of findings) {
        const icon = f.level === 'error' ? 'ERROR' : f.level === 'warn' ? 'WARN ' : 'info ';
        const fix = (f.fix || '').replace(/\|/g, '\\|');
        const msg = f.message.replace(/\|/g, '\\|');
        rows.push(`| \`${icon}\` | \`${f.ruleId}\` | \`${f.file}\` | ${msg}${fix ? ' — ' + fix : ''} |`);
    }
    const details = findings.map(f =>
`<details><summary><code>${f.ruleId}</code> — ${f.file}</summary>

\`\`\`sql
${f.snippet}
\`\`\`
**${f.message}**${f.fix ? `\n\nSuggestion: ${f.fix}` : ''}

</details>`
    ).join('\n');
    return head.join('\n') + '\n' + rows.join('\n') + '\n\n' + details + '\n\n<sub>_FATHOM migration linter_</sub>';
}

const body = render();

async function apiFetch(path, init = {}) {
    const token = process.env.GH_TOKEN;
    if (!token) throw new Error('GH_TOKEN is not set');
    const r = await fetch(`https://api.github.com${path}`, {
        ...init,
        headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${token}`,
            'user-agent': 'fathom-db-migration-review',
            'x-github-api-version': '2022-11-28',
            'content-type': init.body ? 'application/json' : undefined,
            ...(init.headers || {}),
        },
    });
    if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(`GitHub ${r.status} ${r.statusText}: ${text.slice(0, 500)}`);
    }
    if (r.status === 204) return null;
    return r.json();
}

(async () => {
    try {
        // List existing issue comments, paginating until we either find our
        // marker or exhaust the PR. A PR with >500 comments is vanishingly
        // rare; we cap at 10 pages (1000 comments) as a safety rail.
        let existing = null;
        for (let page = 1; page <= 10 && !existing; page++) {
            const batch = await apiFetch(
                `/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`,
            );
            if (!Array.isArray(batch) || batch.length === 0) break;
            existing = batch.find(c => typeof c.body === 'string' && c.body.includes(MARKER));
            if (batch.length < 100) break;
        }

        if (existing) {
            await apiFetch(`/repos/${repo}/issues/comments/${existing.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ body }),
            });
            console.log(`[comment] updated #${existing.id}`);
        } else {
            await apiFetch(`/repos/${repo}/issues/${pr}/comments`, {
                method: 'POST',
                body: JSON.stringify({ body }),
            });
            console.log('[comment] created new comment');
        }
    } catch (err) {
        // Don't fail the job for a comment-posting hiccup — findings are
        // still visible in the action log and the findings-json output.
        console.log(`[comment] failed: ${err.message}`);
    }
})();
