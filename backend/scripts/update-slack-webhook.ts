/**
 * update-slack-webhook.ts — point an existing Slack destination at a new
 * incoming-webhook URL.
 *
 * Reinstalling a Slack app regenerates its incoming webhook. The old URL stops
 * working immediately, so alert delivery fails silently from that moment: the
 * fan-out catches the error, records it on the row, and the alert loop carries
 * on. Nothing in the UI says "Slack is broken".
 *
 *   Show what is registered:
 *     npm run slack:webhook
 *
 *   Update destination 1:
 *     npm run slack:webhook -- --id 1 --url https://hooks.slack.com/services/T.../B.../xxx
 *
 *   Update and immediately prove it works:
 *     npm run slack:webhook -- --id 1 --url https://... --test
 *
 *   Options:
 *     --id <n>     destination id (default: the only enabled Slack one)
 *     --url <url>  the new incoming webhook URL
 *     --org <id>   organisation id (default: FATHOM_DEFAULT_ORG_ID, or 1)
 *     --test       send a test alert through it afterwards
 *
 * Goes through destinationService rather than raw SQL so validation and the
 * updated_at trigger behave exactly as they do for the REST route.
 */

import 'dotenv/config';
import { pool } from '../db.js';
import {
    listDestinations,
    updateDestination,
    getDestination,
    buildNotifierFromRow,
} from '../services/destinationService.js';
import { NotifierManager } from '../services/notifiers/notifierManager.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m';

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

/** Never print a webhook URL in full — the path segments are the credential. */
function redact(url: string): string {
    return url.replace(/(https:\/\/hooks\.slack\.com\/services\/)(.*)/, (_, head, tail) => {
        const parts = String(tail).split('/');
        return head + parts.map((p, idx) => (idx === parts.length - 1 ? '…' + p.slice(-4) : p)).join('/');
    });
}

async function main() {
    const orgId = Number(arg('org') || process.env.FATHOM_DEFAULT_ORG_ID || 1);
    const url = arg('url');

    const existing = await listDestinations(pool, orgId);
    const slack = existing.filter((d) => d.provider === 'slack');

    if (!url) {
        console.log(`\n${B}Slack destinations for org ${orgId}${O}`);
        if (!slack.length) {
            console.log(`${D}  none registered — use npm run slack:add${O}\n`);
        } else {
            for (const d of slack) {
                console.log(
                    `  ${B}${d.id}${O}  ${d.name.padEnd(20)} ` +
                        `${d.enabled ? `${G}enabled${O}` : `${D}disabled${O}`}` +
                        (d.lastStatus ? `  last=${d.lastStatus}` : '') +
                        (d.lastError ? `  ${R}${String(d.lastError).slice(0, 60)}${O}` : ''),
                );
            }
            console.log(`\n${D}  pass --id <n> --url <new webhook> to update one${O}\n`);
        }
        return;
    }

    if (!/^https:\/\/hooks\.slack\.com\/services\/\S+$/.test(url)) {
        throw new Error('--url must be a https://hooks.slack.com/services/... incoming webhook URL');
    }

    // Default to the single enabled Slack destination when there is no ambiguity.
    let id = arg('id') ? Number(arg('id')) : null;
    if (id === null) {
        const enabled = slack.filter((d) => d.enabled);
        if (enabled.length === 1) {
            id = enabled[0].id;
            console.log(`${D}  using destination ${id} (${enabled[0].name})${O}`);
        } else {
            throw new Error(`pass --id — found ${enabled.length} enabled Slack destinations`);
        }
    }

    const before = await getDestination(pool, orgId, id);
    if (!before) throw new Error(`destination ${id} not found for org ${orgId}`);
    if (before.provider !== 'slack') throw new Error(`destination ${id} is ${before.provider}, not slack`);

    // Preserve everything else in config — a destination may carry a template
    // override, and replacing the whole object would silently discard it.
    const config = { ...(before.config || {}), webhookUrl: url };
    delete config.channel; // webhook mode and bot mode are mutually exclusive

    const updated = await updateDestination(pool, orgId, id, { config });
    if (!updated) throw new Error('update returned no row');

    console.log(`\n${G}✔ destination ${id} (${updated.name}) now points at${O}`);
    console.log(`  ${redact(url)}`);

    if (has('test')) {
        console.log(`\n${D}  sending a test alert…${O}`);
        const { rows } = await pool.query(
            `SELECT * FROM pgmonitoringtool.notification_destinations WHERE id = $1`,
            [id],
        );
        const notifier = buildNotifierFromRow(rows[0]);
        if (!notifier) throw new Error('could not build a notifier from the stored row');
        const manager = new NotifierManager({ notifiers: [notifier] } as any);
        const [result] = await manager.dispatch({
            id: `webhook-update-${Date.now()}`,
            severity: 'warning',
            title: 'FATHOM webhook updated',
            message: 'If you can read this, the new incoming webhook is live.',
            source: 'fathom',
            component: 'cli-test',
            timestamp: new Date().toISOString(),
            metadata: {},
            resolved: false,
        });
        const ok = result?.result?.ok ?? result?.ok;
        console.log(ok ? `${G}  ✔ delivered — check Slack${O}` : `${R}  ✖ ${JSON.stringify(result)}${O}`);
        if (!ok) {
            console.log(
                `${Y}  A 404 here means the URL is already stale — reinstalling the app again${O}\n` +
                    `${Y}  regenerates it, so copy the current one from Incoming Webhooks.${O}`,
            );
        }
    }
    console.log('');
}

main()
    .then(() => pool.end())
    .catch(async (err) => {
        console.error(`\n${R}✖ ${err.message}${O}`);
        if (err.validation) for (const v of err.validation) console.error(`${R}  - ${v}${O}`);
        console.error('');
        await pool.end();
        process.exit(1);
    });
