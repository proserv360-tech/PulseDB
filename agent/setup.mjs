#!/usr/bin/env node
/**
 * PulseDB Agent — automatic setup (run via setup.cmd; no admin rights needed).
 *
 *   1. finds the SQL Server instances on this PC and their databases, signing
 *      in with Windows authentication
 *   2. makes sure agent.config.json has a working agent key — minting one
 *      through ../backend/scripts/agent-key.ts when this PC has the PulseDB
 *      backend's .env (the key goes straight into the config, never the screen)
 *   3. installs autostart (restarting the agent if it ever exits) and (re)starts
 *      it: run as administrator, a scheduled task starts it with Windows as SYSTEM
 *      (servers: keeps running with nobody signed in); otherwise the user's
 *      Startup folder. --per-user / --service force either mode.
 *   4. waits until the agent has registered its databases with PulseDB
 *
 *   node setup.mjs [--url https://pulsedb.example.com] [--no-start]
 * Safe to re-run: discovered databases are refreshed, hand-written targets kept.
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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
/**
 * mssql's msnodesqlv8 wrapper turns ODBC errors into "[object Object]" (the
 * driver hands back a plain object, not an Error). Ask the driver directly for
 * the real message, e.g. "Login failed for user 'SERVER\Administrator'".
 */
async function odbcFailure(e, connectionString) {
    const msg = e?.originalError?.message || e?.message;
    if (typeof msg === 'string' && msg && msg !== '[object Object]') return msg;
    try {
        const native = createRequire(import.meta.url)('msnodesqlv8');
        const err = await new Promise((resolve) =>
            native.open(connectionString, (error, conn) => {
                if (conn) conn.close(() => {});
                resolve(error);
            }),
        );
        if (!err) return 'the connection failed, then succeeded on retry';
        const parts = (err.details?.length ? err.details : [err])
            .map((d) => String(d?.message || '').replace(/^(\[[^\]]*\])+/, '').trim())
            .filter((m) => m && !/Invalid connection string attribute/i.test(m));
        return [...new Set(parts)].join(' | ') || JSON.stringify(err);
    } catch {
        return typeof msg === 'string' && msg ? msg : String(e);
    }
}

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
        const connectionString = `Driver={${driver}};Server=${server};Database=master;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;`;
        const p = new v8.ConnectionPool({ connectionString });
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
            lastError = await odbcFailure(e, connectionString);
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
    // Hidden launcher (no window); setup puts a copy in the Startup folder unless
    // the agent runs as an always-on scheduled task.
    const vbs = `CreateObject("WScript.Shell").Run """${runner}""", 0, False\r\n`;
    fs.writeFileSync(path.join(here, 'start-agent-hidden.vbs'), vbs);
    return runner;
}

const TASK_NAME = 'PulseDB Agent';
const powershell = (script, env = {}) =>
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...env },
    });

function isElevated() {
    try {
        execFileSync('net', ['session'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Always-on mode for servers: a scheduled task starts the supervisor at boot as
 * SYSTEM, so the agent keeps running when nobody is signed in (signing out of
 * Remote Desktop no longer stops it). Replaces the sign-in autostart: one agent
 * per machine.
 */
function installBootTask(runner) {
    powershell(
        `$a = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "' + $env:PULSEDB_RUNNER + '"');
         $t = New-ScheduledTaskTrigger -AtStartup;
         $p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest;
         $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1);
         Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $a -Trigger $t -Principal $p -Settings $s -Force | Out-Null`,
        { PULSEDB_RUNNER: runner },
    );
    fs.rmSync(path.join(startupFolder(), 'PulseDB Agent.vbs'), { force: true });
}

/** Back to sign-in autostart: remove an earlier boot task (needs admin; harmless otherwise). */
function removeBootTask() {
    try {
        powershell(`if (Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false }`);
    } catch {
        /* not elevated: uninstall-agent.cmd as administrator removes it */
    }
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
if (!config.targets.length) {
    if (config.relayConnections === false) fail('No SQL Server databases found to monitor.');
    // Fine: SQL Server may refuse this Windows account (Sage instances, for one,
    // use a SQL login). Connections added in PulseDB with a SQL login are relayed.
    console.log(
        '    No databases reachable with Windows sign-in. That is fine: the agent still runs and\n' +
            '    connects the connections you add in PulseDB with a SQL login (for example "sa").',
    );
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 4) + '\n');

step(`Agent key for ${config.pulsedbUrl}`);
if (await keyWorks(config.pulsedbUrl, config.agentKey)) console.log('    Existing key is valid.');
else mintKey();

step('Installing autostart and starting the agent');
// Run as administrator -> always-on boot task (servers). Not when a database is
// reached with this Windows account's own sign-in: the SYSTEM account would not have it.
const elevated = isElevated();
const usesOwnSignIn = config.targets.some((t) => t.windowsAuth === true);
const bootTask = elevated && !process.argv.includes('--per-user') && (!usesOwnSignIn || process.argv.includes('--service'));
const stopped = stopRunningAgents();
if (stopped) console.log(`    Stopped ${stopped} running agent process(es).`);
const runner = installAutostart();
if (bootTask) {
    try {
        installBootTask(runner);
    } catch (e) {
        fail(`Could not create the "${TASK_NAME}" scheduled task: ${String(e.stderr || e.message).trim().slice(0, 400)}`);
    }
    console.log(`    Always on: scheduled task "${TASK_NAME}" starts the agent with Windows (no sign-in needed).`);
} else {
    if (elevated) removeBootTask();
    fs.writeFileSync(path.join(startupFolder(), 'PulseDB Agent.vbs'), fs.readFileSync(path.join(here, 'start-agent-hidden.vbs')));
    console.log(`    Autostart: ${path.join(startupFolder(), 'PulseDB Agent.vbs')} (runs while you are signed in to Windows)`);
    if (!elevated) console.log('    On a server: right-click setup.cmd -> "Run as administrator" to keep the agent running when nobody is signed in.');
    else if (usesOwnSignIn) console.log('    Kept per-user: the databases above use your Windows sign-in, which a background task would not have.');
}
if (process.argv.includes('--no-start')) process.exit(0);
// Running setup is the deliberate way to bring back databases deleted in PulseDB.
fs.writeFileSync(path.join(here, 'restore-targets.flag'), new Date().toISOString());
const since = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
if (bootTask) powershell(`Start-ScheduledTask -TaskName '${TASK_NAME}'`);
else spawn('wscript.exe', [path.join(here, 'start-agent-hidden.vbs')], { detached: true, stdio: 'ignore' }).unref();

const reg = await waitForRegistration(since);
if (reg.error) fail(`The agent started but did not register: ${reg.error}`);
console.log(`\nDone. PulseDB Agent is running and registered with ${config.pulsedbUrl}:`);
for (const c of reg.connections || []) console.log(`    ${c}`);
if (config.targets.length) console.log('\nOpen PulseDB -> Connections: these databases are listed with a VIA AGENT badge.');
else
    console.log(
        '\nIn PulseDB add (or Test) a SQL Server connection to this server with its SQL login\n' +
            '(for example host ' + os.hostname() + '\\<instance>, user sa): it is connected through this agent.',
    );
