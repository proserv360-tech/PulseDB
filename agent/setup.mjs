#!/usr/bin/env node
/**
 * PulseDB Agent — automatic setup (run via setup.cmd; no admin rights needed).
 *
 *   1. finds the SQL Server instances on this PC and their databases, signing
 *      in with Windows authentication
 *   2. makes sure agent.config.json has a working agent key — minting one
 *      through ../backend/scripts/agent-key.ts when this PC has the PulseDB
 *      backend's .env (the key goes straight into the config, never the screen)
 *   3. installs autostart for the current user (Startup folder, restarts the
 *      agent if it ever exits) and (re)starts the agent in the background
 *   4. waits until the agent has registered its databases with PulseDB
 *
 *   node setup.mjs [--url https://pulsedb.example.com] [--no-start]
 * Safe to re-run: discovered databases are refreshed, hand-written targets kept.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, 'agent.config.json');
const logDir = path.join(here, 'logs');
const logFile = path.join(logDir, 'agent.log');
const DEFAULT_URL = 'https://pulsedb-o8ax.vercel.app';
const arg = (flag) => {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : undefined;
};
const step = (msg) => console.log(`\n==> ${msg}`);
const fail = (msg) => {
    console.error(`\nERROR: ${msg}`);
    process.exit(1);
};

// ── 1. discover local SQL Server instances and databases ───────────────────
function installedInstances() {
    try {
        const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        return out
            .split(/\r?\n/)
            .map((l) => l.trim().split(/\s{2,}/))
            .filter((p) => p.length >= 3 && p[1] === 'REG_SZ')
            .map((p) => p[0]);
    } catch {
        return [];
    }
}

async function listDatabases(v8, instance) {
    const server = instance === 'MSSQLSERVER' ? 'localhost' : `localhost\\${instance}`;
    let lastError;
    for (const driver of ['ODBC Driver 18 for SQL Server', 'ODBC Driver 17 for SQL Server']) {
        const p = new v8.ConnectionPool({
            connectionString: `Driver={${driver}};Server=${server};Database=master;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;`,
        });
        try {
            await p.connect();
            const r = await p.request().query(
                `SELECT name FROM sys.databases
                  WHERE database_id > 4 AND state = 0 AND HAS_DBACCESS(name) = 1
                  ORDER BY name`,
            );
            await p.close();
            return { server, databases: r.recordset.map((x) => x.name) };
        } catch (e) {
            lastError = e.originalError?.message || e.message;
            await p.close().catch(() => {});
            if (!/IM002|data source name not found|not found/i.test(lastError)) break;
        }
    }
    return { server, error: lastError };
}

// ── 2. key ─────────────────────────────────────────────────────────────────
async function keyWorks(url, key) {
    if (!key || /CHANGE-ME/.test(key)) return false;
    // Posting a result for a job that does not exist authenticates the key with no side effects.
    const res = await fetch(`${url}/api/agent/jobs/00000000-0000-0000-0000-000000000000/result`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-sdk-key': key },
        body: JSON.stringify({ ok: false, error: 'setup key check' }),
        signal: AbortSignal.timeout(20_000),
    });
    return res.status !== 401;
}

function mintKey() {
    const backend = path.resolve(here, '..', 'backend');
    if (!fs.existsSync(path.join(backend, '.env')) || !fs.existsSync(path.join(backend, 'scripts', 'agent-key.ts'))) {
        fail(
            'This agent has no valid key (never set, or its SDK application was deleted).\n' +
                'In PulseDB open Connections -> "Connect another PC" to download a fresh agent package,\n' +
                'unzip it and run its setup.cmd.',
        );
    }
    let out;
    try {
        out = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/agent-key.ts', '--config', configPath], {
            cwd: backend,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    } catch (e) {
        const msg = String(e.stderr || '').match(/PULSEDB_AGENT_KEY_ERROR (.*)/)?.[1] || String(e.stderr || e.message).slice(0, 400);
        fail(`Could not create the agent key: ${msg}`);
    }
    const info = JSON.parse(out.match(/PULSEDB_AGENT_KEY_OK (.*)/)[1]);
    console.log(`    ${info.rotated ? 'Rotated the key of' : 'Created'} agent "${info.name}" (owned by ${info.owner})`);
}

// ── 3. autostart + (re)start ───────────────────────────────────────────────
function startupFolder() {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function installAutostart() {
    fs.mkdirSync(logDir, { recursive: true });
    // Supervisor: restart the agent 10s after it exits; keep the log under ~5 MB.
    const runner = path.join(here, 'run-agent.cmd');
    fs.writeFileSync(
        runner,
        [
            '@echo off',
            'rem PulseDB Agent supervisor (written by setup.mjs) - restarts the agent if it exits.',
            `cd /d "${here}"`,
            ':loop',
            'for %%F in ("logs\\agent.log") do if %%~zF GTR 5000000 move /y "logs\\agent.log" "logs\\agent.old.log" >nul',
            `"${process.execPath}" pulsedb-agent.mjs >> "logs\\agent.log" 2>&1`,
            'timeout /t 10 /nobreak >nul',
            'goto loop',
            '',
        ].join('\r\n'),
    );
    // Hidden launcher in the user's Startup folder: runs at every sign-in, no window.
    const vbs = `CreateObject("WScript.Shell").Run """${runner}""", 0, False\r\n`;
    fs.writeFileSync(path.join(here, 'start-agent-hidden.vbs'), vbs);
    fs.writeFileSync(path.join(startupFolder(), 'PulseDB Agent.vbs'), vbs);
    return runner;
}

function stopRunningAgents() {
    // Only node/cmd processes running this folder's agent or supervisor.
    const ps = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*pulsedb-agent.mjs*' -and $_.CommandLine -notlike '*--config*') -or ($_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*${here.replace(/'/g, "''")}\\run-agent.cmd*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $_.ProcessId }`;
    try {
        const out = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim();
        return out ? out.split(/\s+/).length : 0;
    } catch {
        return 0;
    }
}

async function waitForRegistration(sinceBytes) {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        if (!fs.existsSync(logFile)) continue;
        const text = fs.readFileSync(logFile, 'utf8').slice(sinceBytes);
        const reg = text.split(/\r?\n/).find((l) => l.includes('"registered with'));
        if (reg) return JSON.parse(reg);
        const err = text.split(/\r?\n/).filter((l) => l.includes('"level":"error"')).pop();
        if (err && /401|invalid config/.test(err)) return { error: JSON.parse(err).msg };
    }
    return { error: `no registration within 45s — see ${logFile}` };
}

// ── main ───────────────────────────────────────────────────────────────────
const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : { pulsedbUrl: DEFAULT_URL, agentKey: 'CHANGE-ME', allowWrites: false, targets: [] };
config.pulsedbUrl = String(arg('--url') || config.pulsedbUrl || DEFAULT_URL).replace(/\/+$/, '');

step('Finding SQL Server on this PC');
let v8;
try {
    const m = await import('mssql/msnodesqlv8.js');
    v8 = m.default ?? m;
} catch (e) {
    fail(`The Windows-authentication driver is not installed (run setup.cmd, which installs it): ${e.message}`);
}
const instances = installedInstances();
if (!instances.length) console.log('    No SQL Server instances registered on this PC.');
const discovered = [];
for (const instance of instances) {
    const r = await listDatabases(v8, instance);
    const label = `${os.hostname()}${instance === 'MSSQLSERVER' ? '' : `\\${instance}`}`;
    if (r.error) {
        console.log(`    ${label}: skipped — ${r.error}`);
        continue;
    }
    const dbs = r.databases.length ? r.databases : ['master'];
    console.log(`    ${label}: ${dbs.join(', ')}`);
    for (const db of dbs) {
        discovered.push({
            name: `${label} · ${db}`,
            engine: 'mssql',
            host: r.server,
            database: db,
            windowsAuth: true,
            encrypt: false,
            trustServerCertificate: true,
            auto: true,
        });
    }
}
// Keep hand-written targets; replace the ones setup found last time.
config.targets = [...(config.targets || []).filter((t) => !t.auto), ...discovered];
if (!config.targets.length) fail('No SQL Server databases found to monitor.');
fs.writeFileSync(configPath, JSON.stringify(config, null, 4) + '\n');

step(`Agent key for ${config.pulsedbUrl}`);
if (await keyWorks(config.pulsedbUrl, config.agentKey)) console.log('    Existing key is valid.');
else mintKey();

step('Installing autostart and starting the agent');
const stopped = stopRunningAgents();
if (stopped) console.log(`    Stopped ${stopped} running agent process(es).`);
installAutostart();
console.log(`    Autostart: ${path.join(startupFolder(), 'PulseDB Agent.vbs')}`);
if (process.argv.includes('--no-start')) process.exit(0);
const since = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
spawn('wscript.exe', [path.join(here, 'start-agent-hidden.vbs')], { detached: true, stdio: 'ignore' }).unref();

const reg = await waitForRegistration(since);
if (reg.error) fail(`The agent started but did not register: ${reg.error}`);
console.log(`\nDone. PulseDB Agent is running and registered with ${config.pulsedbUrl}:`);
for (const c of reg.connections || []) console.log(`    ${c}`);
console.log('\nOpen PulseDB -> Connections: these databases are listed with a VIA AGENT badge.');
