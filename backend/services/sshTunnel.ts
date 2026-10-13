// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * services/sshTunnel.js
 * ─────────────────────
 * SSH tunnel management using the system `ssh` CLI (no extra npm deps).
 *
 * Strategy
 * ────────
 * For each connection with sshEnabled=true, we spawn:
 *   ssh -N -L localPort:dbHost:dbPort sshUser@sshHost -p sshPort
 *
 * Authentication:
 *   - Private key: key PEM is written to a secure temp file, passed via -i
 *   - Password:    a tiny SSH_ASKPASS helper script is written to /tmp and used
 *                  with SSH_ASKPASS_REQUIRE=force to feed the password without
 *                  an interactive prompt
 *
 * Lifecycle
 * ─────────
 *   openTunnel(connId, cfg)  → resolves with localPort once the tunnel is ready
 *   closeTunnel(connId)      → kills the ssh process and cleans temp files
 *   getTunnelPort(connId)    → returns localPort if tunnel is alive, else null
 *   closeAll()               → gracefully close all tunnels (called at shutdown)
 */

import { spawn }            from 'child_process';
import { createServer, Socket } from 'net';
import { writeFile, unlink } from 'fs/promises';
import { existsSync }        from 'fs';
import { randomBytes }       from 'crypto';
import os                    from 'os';
import path                  from 'path';

// ── Map: connId → { proc, localPort, keyFile, askpassFile } ──────────────────
const tunnels = new Map();

function log(level, msg, meta = {}) {
    console[level === 'ERROR' ? 'error' : 'log'](
        JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta })
    );
}

// ─── Find a free local port ───────────────────────────────────────────────────
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(err => err ? reject(err) : resolve(port));
        });
    });
}

// ─── Wait until a TCP port is accepting connections ───────────────────────────
function waitForPort(port, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const tryConnect = () => {
            const sock = new Socket();
            sock.setTimeout(800);
            sock.connect(port, '127.0.0.1', () => { sock.destroy(); resolve(); });
            sock.on('error', () => {
                sock.destroy();
                if (Date.now() > deadline) return reject(new Error(`Tunnel did not become ready in ${timeoutMs}ms`));
                setTimeout(tryConnect, 300);
            });
            sock.on('timeout', () => {
                sock.destroy();
                if (Date.now() > deadline) return reject(new Error(`Tunnel timed out`));
                setTimeout(tryConnect, 300);
            });
        };
        tryConnect();
    });
}

// ─── Write a temp file with restricted permissions ────────────────────────────
async function writeTempFile(prefix, content, mode = 0o600) {
    const file = path.join(os.tmpdir(), `${prefix}_${randomBytes(8).toString('hex')}`);
    await writeFile(file, content, { mode });
    return file;
}

async function removeTempFile(file) {
    if (file && existsSync(file)) {
        try { await unlink(file); } catch {}
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open an SSH tunnel for the given connection config.
 * Resolves with the local port the tunnel is bound to.
 *
 * @param {string|number} connId     - unique connection identifier
 * @param {object}        cfg        - SSH + DB config
 * @param {string}        cfg.sshHost
 * @param {number}        cfg.sshPort        (default 22)
 * @param {string}        cfg.sshUser
 * @param {'key'|'password'} cfg.sshAuthType
 * @param {string}        [cfg.sshPrivateKey] - PEM content
 * @param {string}        [cfg.sshPassphrase] - key passphrase
 * @param {string}        [cfg.sshPassword]   - SSH password
 * @param {string}        cfg.dbHost         - private DB hostname (seen from bastion)
 * @param {number}        cfg.dbPort         - DB port
 */
export async function openTunnel(connId, cfg) {
    // Close existing tunnel if any
    await closeTunnel(connId);

    const localPort = await getFreePort();
    let keyFile     = null;
    let askpassFile = null;

    const sshPort = cfg.sshPort || 22;

    // Base SSH args — stable, no interactive prompts
    const args = [
        '-N',                               // don't run a remote command
        '-o', 'StrictHostKeyChecking=no',   // skip host-key prompt in automation
        '-o', 'BatchMode=no',               // allow askpass
        '-o', `ServerAliveInterval=30`,
        '-o', `ServerAliveCountMax=3`,
        '-o', `ConnectTimeout=15`,
        '-L', `127.0.0.1:${localPort}:${cfg.dbHost}:${cfg.dbPort}`,
        '-p', String(sshPort),
        `${cfg.sshUser}@${cfg.sshHost}`,
    ];

    const env = { ...process.env };

    if (cfg.sshAuthType === 'key' && cfg.sshPrivateKey) {
        // Write private key to temp file with strict permissions
        keyFile = await writeTempFile('ssh_key', cfg.sshPrivateKey.trim() + '\n', 0o600);
        args.splice(args.indexOf('-N') + 1, 0, '-i', keyFile);

        // Handle passphrase via SSH_ASKPASS
        if (cfg.sshPassphrase) {
            askpassFile = await writeTempFile('ssh_askpass', `#!/bin/sh\necho ${JSON.stringify(cfg.sshPassphrase)}\n`, 0o700);
            env.SSH_ASKPASS = askpassFile;
            env.SSH_ASKPASS_REQUIRE = 'force';
            delete env.DISPLAY;
        } else {
            // No passphrase — force batch mode to avoid hanging
            args.push('-o', 'PasswordAuthentication=no');
        }
    } else if (cfg.sshAuthType === 'password' && cfg.sshPassword) {
        // Feed password via SSH_ASKPASS helper
        askpassFile = await writeTempFile('ssh_askpass', `#!/bin/sh\necho ${JSON.stringify(cfg.sshPassword)}\n`, 0o700);
        env.SSH_ASKPASS = askpassFile;
        env.SSH_ASKPASS_REQUIRE = 'force';
        delete env.DISPLAY; // must be unset for SSH_ASKPASS to work on Linux
    } else {
        throw new Error('SSH auth requires either a private key or a password');
    }

    return new Promise((resolve, reject) => {
        const proc = spawn('ssh', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';

        proc.stderr.on('data', d => { stderr += d.toString(); });

        proc.on('error', async (err) => {
            await removeTempFile(keyFile);
            await removeTempFile(askpassFile);
            reject(new Error(`Failed to spawn ssh: ${err.message}`));
        });

        proc.on('exit', async (code, signal) => {
            const existing = tunnels.get(String(connId));
            if (existing) {
                tunnels.delete(String(connId));
                await removeTempFile(existing.keyFile);
                await removeTempFile(existing.askpassFile);
            }
            if (code !== null && code !== 0) {
                log('WARN', 'SSH tunnel exited', { connId, code, signal, stderr: stderr.slice(0, 400) });
            }
        });

        // Store tunnel info immediately (before ready) so we can clean up on error
        tunnels.set(String(connId), { proc, localPort, keyFile, askpassFile });

        // Wait for the tunnel local port to become ready
        waitForPort(localPort, 20_000)
            .then(() => {
                log('INFO', 'SSH tunnel ready', { connId, localPort, sshHost: cfg.sshHost });
                resolve(localPort);
            })
            .catch(async (err) => {
                await closeTunnel(connId);
                reject(new Error(`SSH tunnel failed to become ready: ${err.message}. SSH stderr: ${stderr.slice(0, 300)}`));
            });
    });
}

/**
 * Close the SSH tunnel for a connection and clean up temp files.
 */
export async function closeTunnel(connId) {
    const t = tunnels.get(String(connId));
    if (!t) return;
    tunnels.delete(String(connId));
    try { t.proc.kill('SIGTERM'); } catch {}
    await removeTempFile(t.keyFile);
    await removeTempFile(t.askpassFile);
    log('INFO', 'SSH tunnel closed', { connId });
}

/**
 * Returns the local port for an active tunnel, or null if none.
 */
export function getTunnelPort(connId) {
    const t = tunnels.get(String(connId));
    if (!t) return null;
    // Check process is still alive
    if (t.proc.exitCode !== null || t.proc.killed) {
        tunnels.delete(String(connId));
        return null;
    }
    return t.localPort;
}

/**
 * Close all active tunnels — call this during process shutdown.
 */
export async function closeAll() {
    await Promise.all([...tunnels.keys()].map(id => closeTunnel(id)));
}
