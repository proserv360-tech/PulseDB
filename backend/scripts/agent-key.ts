// @ts-nocheck — operator script, typed loosely like the other scripts/
/**
 * Mint (or rotate) the PulseDB Agent key for this machine and write it into
 * an agent config file — used by agent/setup.mjs on a machine that also has
 * this backend's .env (so it can reach the PulseDB database directly).
 *
 *   npx tsx scripts/agent-key.ts --config ..\agent\agent.config.json [--owner admin]
 *
 * One SDK application per machine (config.machine = hostname). Re-running
 * rotates that application's key in place, so the connections the agent
 * registered stay linked to it. The key is written to the config file only —
 * never printed.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pool } from '../db.js';
import { registerApp } from '../services/sdkService.js';

const S = 'pgmonitoringtool';
const arg = (flag) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
    const configPath = arg('--config');
    if (!configPath) throw new Error('--config <path to agent.config.json> is required');
    const config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8'));
    const machine = os.hostname();

    const owner = arg('--owner');
    const {
        rows: [user],
    } = await pool.query(
        owner
            ? `SELECT id, username FROM ${S}.users WHERE username = $1`
            : `SELECT id, username FROM ${S}.users WHERE role = 'super_admin' ORDER BY id LIMIT 1`,
        owner ? [owner] : [],
    );
    if (!user) throw new Error(owner ? `No PulseDB user "${owner}"` : 'No super_admin user in PulseDB');

    const key = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const {
        rows: [existing],
    } = await pool.query(
        `SELECT id, name FROM ${S}.sdk_applications
          WHERE config->>'pulsedbAgent' = 'true' AND config->>'machine' = $1
          ORDER BY id LIMIT 1`,
        [machine],
    );
    let app;
    if (existing) {
        await pool.query(
            `UPDATE ${S}.sdk_applications
                SET api_key_hash = $2, api_key_prefix = $3, status = 'active', updated_at = now()
              WHERE id = $1`,
            [existing.id, hash, key.slice(0, 12)],
        );
        app = { id: existing.id, name: existing.name, rotated: true };
    } else {
        const { record } = await registerApp(pool, {
            name: `${machine} agent`,
            appType: 'custom',
            environment: 'production',
            config: { pulsedbAgent: true, machine },
            createdBy: user.id,
        });
        // registerApp minted its own key; replace it with ours so we never handle two.
        await pool.query(`UPDATE ${S}.sdk_applications SET api_key_hash = $2, api_key_prefix = $3 WHERE id = $1`, [
            record.id,
            hash,
            key.slice(0, 12),
        ]);
        app = { id: record.id, name: record.name, rotated: false };
    }

    config.agentKey = key;
    fs.writeFileSync(path.resolve(configPath), JSON.stringify(config, null, 4) + '\n');
    console.log(
        `PULSEDB_AGENT_KEY_OK ${JSON.stringify({ appId: app.id, name: app.name, rotated: app.rotated, owner: user.username })}`,
    );
}

main()
    .then(() => pool.end())
    .catch(async (e) => {
        console.error(`PULSEDB_AGENT_KEY_ERROR ${e.message}`);
        await pool.end().catch(() => {});
        process.exit(1);
    });
