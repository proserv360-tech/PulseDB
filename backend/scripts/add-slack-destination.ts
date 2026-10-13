/**
 * add-slack-destination.ts — register a Slack alert destination from the CLI.
 *
 * The REST route (POST /api/integrations) needs an authenticated session and an
 * org context, which is awkward from a terminal. This calls the same service
 * layer directly, so validation, AES-256-GCM secret encryption and the unique
 * name constraint all behave identically.
 *
 *   List what exists:
 *     npm run slack:add
 *
 *   Incoming webhook (simplest, one-way):
 *     npm run slack:add -- --webhook https://hooks.slack.com/services/T.../B.../xxx
 *
 *   Bot token (supports threaded replies and in-place message updates):
 *     npm run slack:add -- --channel C0123456789 --token xoxb-...
 *
 *   Options:
 *     --name <label>       destination name        (default: slack-alerts)
 *     --severity <level>   debug|info|warning|error|critical  (default: warning)
 *     --org <id>           organisation id         (default: FATHOM_DEFAULT_ORG_ID, or the only org)
 *     --test               send a test alert through it afterwards
 *
 * Requires ENCRYPTION_KEY in .env — secrets are encrypted at rest.
 */

import 'dotenv/config';
import { pool } from '../db.js';
import { createDestination, listDestinations, buildNotifierFromRow } from '../services/destinationService.js';
import { NotifierManager } from '../services/notifiers/notifierManager.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m';

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

/** Pick an org: explicit flag, then env, then the only one that exists. */
async function resolveOrgId(): Promise<number> {
    const explicit = arg('org') || process.env.FATHOM_DEFAULT_ORG_ID;
    if (explicit) return Number(explicit);

    if (!(await pool.query(`SELECT to_regclass('pgmonitoringtool.organizations') AS t`)).rows[0].t) {
        // No organizations table on this database — destinations are still
        // usable because 0025 leaves org_id unconstrained when the parent is
        // absent. Default to 1 and let FATHOM_DEFAULT_ORG_ID match it.
        console.log(`${Y}  no organizations table — defaulting to org_id 1${O}`);
        return 1;
    }
    const { rows } = await pool.query(`SELECT id, name FROM pgmonitoringtool.organizations ORDER BY id`);
    if (rows.length === 0) throw new Error('no organizations exist — create one, or pass --org');
    if (rows.length > 1) {
        console.log(`${Y}  multiple orgs found — pass --org <id>:${O}`);
        for (const r of rows) console.log(`    ${r.id}  ${r.name}`);
        throw new Error('ambiguous organisation');
    }
    console.log(`${D}  using org ${rows[0].id} (${rows[0].name})${O}`);
    return rows[0].id;
}

async function main() {
    if (!process.env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY is not set — secrets cannot be encrypted at rest');
    }

    const orgId = await resolveOrgId();
    const webhook = arg('webhook');
    const channel = arg('channel');
    const token = arg('token');

    // No creation flags — just show what is already registered.
    if (!webhook && !channel) {
        const existing = await listDestinations(pool, orgId);
        console.log(`\n${B}Destinations for org ${orgId}${O}`);
        if (!existing.length) {
            console.log(`${D}  none yet — pass --webhook or --channel + --token${O}\n`);
        } else {
            for (const d of existing) {
                const flag = d.enabled ? `${G}enabled${O}` : `${D}disabled${O}`;
                console.log(
                    `  ${B}${d.id}${O}  ${d.provider.padEnd(10)} ${d.name.padEnd(20)} ` +
                        `min=${String(d.minSeverity).padEnd(8)} ${flag}` +
                        (d.lastStatus ? `  last=${d.lastStatus}` : ''),
                );
            }
            console.log('');
        }
        return;
    }

    if (channel && !token) throw new Error('--channel also needs --token (the xoxb-… bot token)');

    const input = {
        name: arg('name') || 'slack-alerts',
        provider: 'slack',
        minSeverity: arg('severity') || 'warning',
        enabled: true,
        config: webhook ? { webhookUrl: webhook } : { channel },
        secret: webhook ? null : token,
    };

    const created = await createDestination(pool, orgId, input, null);
    if (!created) throw new Error('destination was not created');
    console.log(`\n${G}✔ created destination ${created.id} — ${created.name}${O}`);
    console.log(`${D}  provider=slack  min_severity=${created.minSeverity}  org=${orgId}${O}`);
    console.log(
        `${D}  mode=${webhook ? 'incoming webhook' : 'bot token'}  secret ${created.hasSecret ? 'encrypted at rest' : 'not required'}${O}`,
    );

    if (process.env.FATHOM_DEFAULT_ORG_ID !== String(orgId)) {
        console.log(
            `\n${Y}  Set FATHOM_DEFAULT_ORG_ID=${orgId} in backend/.env, otherwise alerts` +
                `\n  fire with no org and this destination is never reached.${O}`,
        );
    }

    if (has('test')) {
        console.log(`\n${D}  sending a test alert…${O}`);
        const { rows } = await pool.query(
            `SELECT * FROM pgmonitoringtool.notification_destinations WHERE id = $1`,
            [created.id],
        );
        const notifier = buildNotifierFromRow(rows[0]);
        if (!notifier) throw new Error('could not build a notifier from the stored row');
        // NotifierManager's ctor param is inferred as never[] from its default,
        // so the concrete notifier union needs an explicit cast here.
        const manager = new NotifierManager({ notifiers: [notifier] } as any);
        const [result] = await manager.dispatch({
            id: `test-${Date.now()}`,
            severity: 'warning',
            title: 'FATHOM test alert',
            message: 'If you can read this in Slack, the destination is wired up.',
            source: 'fathom',
            component: 'cli-test',
            timestamp: new Date().toISOString(),
            metadata: {},
            resolved: false,
        });
        const ok = result?.result?.ok ?? result?.ok;
        console.log(ok ? `${G}  ✔ delivered — check Slack${O}` : `${R}  ✖ ${JSON.stringify(result)}${O}`);
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
