/**
 * run-sql.ts — execute a .sql file without needing the psql binary.
 *
 *   npm run sql -- db/migrations/0026_alerts_rules_split.sql
 *   npm run sql -- scripts/inspect-alert-schema.sql
 *
 * Uses the shared pool from db.ts, so it picks up DATABASE_URL (or the PG*
 * variables) and the same SSL handling as the server. Nothing to install.
 *
 * Handles the two psql features these files use:
 *   • `\echo text`  — printed as a heading, not sent to the server.
 *   • RAISE NOTICE  — surfaced, since the migrations report what they did
 *                     through notices.
 *
 * The file is split into chunks at each `\echo`, and each chunk is sent as one
 * multi-statement query. That keeps `DO $$ ... $$` blocks and `BEGIN/COMMIT`
 * intact — naive splitting on semicolons would tear them apart.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';

const rel = process.argv[2];
if (!rel) {
    console.error('usage: npm run sql -- <path/to/file.sql>');
    process.exit(1);
}

const file = path.resolve(process.cwd(), rel);
if (!fs.existsSync(file)) {
    console.error(`not found: ${file}`);
    process.exit(1);
}

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const OFF = '\x1b[0m';

type Chunk = { echo?: string; sql: string };

/** Split into chunks at `\echo` lines, leaving SQL bodies untouched. */
function parse(src: string): Chunk[] {
    const chunks: Chunk[] = [];
    let echo: string | undefined;
    let buf: string[] = [];

    const flush = () => {
        const sql = buf.join('\n').trim();
        if (echo !== undefined || sql) chunks.push({ echo, sql });
        buf = [];
        echo = undefined;
    };

    for (const line of src.split('\n')) {
        const m = line.match(/^\s*\\echo\s*(.*)$/);
        if (m) {
            flush();
            echo = m[1].trim().replace(/^'(.*)'$/, '$1');
        } else if (/^\s*\\/.test(line)) {
            // any other psql meta-command — skip it rather than send it
        } else {
            buf.push(line);
        }
    }
    flush();
    return chunks;
}

function printRows(rows: Record<string, unknown>[]) {
    if (!rows?.length) {
        console.log(`${DIM}   (no rows)${OFF}`);
        return;
    }
    const cols = Object.keys(rows[0]);
    const w = cols.map((c) =>
        Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)),
    );
    const line = (cells: string[]) => '   ' + cells.map((s, i) => s.padEnd(w[i])).join('  ');
    console.log(`${BOLD}${line(cols)}${OFF}`);
    console.log(`${DIM}${line(w.map((n) => '─'.repeat(n)))}${OFF}`);
    for (const r of rows) console.log(line(cols.map((c) => String(r[c] ?? ''))));
}

async function main() {
    console.log(`\n${BOLD}▶ ${path.relative(process.cwd(), file)}${OFF}`);

    const client = await pool.connect();
    // Migrations report what they did via RAISE NOTICE — don't lose them.
    client.on('notice', (n) => console.log(`${YELLOW}   notice: ${n.message}${OFF}`));

    let failed = false;
    try {
        for (const { echo, sql } of parse(fs.readFileSync(file, 'utf8'))) {
            if (echo !== undefined) console.log(`\n${BOLD}${echo}${OFF}`);
            if (!sql) continue;

            const res = await client.query(sql);
            for (const r of Array.isArray(res) ? res : [res]) {
                if (r?.command === 'SELECT' || r?.rows?.length) printRows(r.rows);
            }
        }
        console.log(`\n${GREEN}✔ done${OFF}\n`);
    } catch (err: any) {
        failed = true;
        console.error(`\n${RED}✖ ${err.message}${OFF}`);
        // Postgres detail fields are where the useful part usually is.
        for (const k of ['detail', 'hint', 'where', 'position'] as const) {
            if (err[k]) console.error(`${RED}  ${k}: ${err[k]}${OFF}`);
        }
        console.error(
            `${DIM}  The file runs in a transaction, so nothing was committed.${OFF}\n`,
        );
    } finally {
        client.release();
        await pool.end();
    }
    process.exit(failed ? 1 : 0);
}

main();
