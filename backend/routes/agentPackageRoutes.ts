// @ts-nocheck — legacy JS style to match sibling routes; type later (see docs/TS_MIGRATION.md)
/**
 * routes/agentPackageRoutes.js
 * ────────────────────────────
 * "Connect another PC": a ready-to-run PulseDB Agent download.
 *
 *   POST /api/agent/package  (admin)
 *     → { fileName, zipBase64 }  PulseDB-Agent/ with the agent, setup.cmd and an
 *       agent.config.json holding this PulseDB's address and a fresh agent key.
 *
 * On the other PC: unzip, double-click setup.cmd. It installs Node.js and the
 * SQL Server ODBC driver if missing, finds the local SQL Server databases
 * (Windows authentication) and registers them here — nothing to type.
 * The key is created per download and shown nowhere else; delete the SDK
 * application to revoke it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { registerApp } from '../services/sdkService.js';
import { zipStore } from '../services/zipStore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const AGENT_FILES = [
    'pulsedb-agent.mjs',
    'readOnlyGuard.mjs',
    'setup.mjs',
    'setup.cmd',
    'uninstall-agent.cmd',
    'uninstall-agent.ps1',
    'package.json',
    'package-lock.json',
    'agent.config.example.json',
    'README.md',
];

function agentDir() {
    const candidates = [path.resolve(here, '..', '..', 'agent'), path.resolve(process.cwd(), 'agent')];
    const dir = candidates.find((d) => fs.existsSync(path.join(d, 'pulsedb-agent.mjs')));
    if (!dir) throw Object.assign(new Error('Agent files are not part of this deployment.'), { status: 500 });
    return dir;
}

/** The address the browser used to reach this PulseDB — what the agent should call. */
function publicUrl(req) {
    const origin = req.get('origin');
    if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/+$/, '');
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    return `${proto}://${req.get('x-forwarded-host') || req.get('host')}`;
}

export default function agentPackageRoutes(pool, authenticate, requireRole, log) {
    const router = Router();
    const gate = requireRole ? requireRole('admin', 'super_admin') : (_req, _res, next) => next();

    router.post('/agent/package', authenticate, gate, async (req, res) => {
        try {
            const dir = agentDir();
            const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
            const { key, record } = await registerApp(pool, {
                name: `PulseDB Agent (downloaded ${stamp})`,
                appType: 'custom',
                environment: 'production',
                // machine is filled in by the agent's first registration (it renames the app).
                config: { pulsedbAgent: true, packaged: true },
                createdBy: req.user.id,
            });
            const config = {
                pulsedbUrl: publicUrl(req),
                agentKey: key,
                allowWrites: false,
                targets: [],
            };
            const files = AGENT_FILES.filter((f) => fs.existsSync(path.join(dir, f))).map((f) => ({
                name: `PulseDB-Agent/${f}`,
                data: fs.readFileSync(path.join(dir, f)),
            }));
            files.push({ name: 'PulseDB-Agent/agent.config.json', data: JSON.stringify(config, null, 4) + '\n' });
            const zip = zipStore(files);
            log('INFO', 'Agent package downloaded', { appId: record.id, by: req.user.id, bytes: zip.length });
            res.set('Cache-Control', 'no-store');
            res.json({ fileName: 'PulseDB-Agent.zip', zipBase64: zip.toString('base64'), appId: record.id });
        } catch (e) {
            log('WARN', 'Agent package failed', { error: e.message });
            res.status(e.status || 500).json({ error: e.message });
        }
    });

    return router;
}
