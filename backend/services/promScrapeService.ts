// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * promScrapeService.js
 *
 * Lightweight Prometheus text-format exposition for /metrics.
 *
 * Covers process-level metrics that every Prom scrape consumer expects:
 *   • fathom_process_uptime_seconds
 *   • fathom_process_memory_rss_bytes / heap_used_bytes
 *   • fathom_event_loop_lag_seconds   (best-effort via perf_hooks)
 *   • fathom_http_requests_total{method,status} — bumped by requestCounter()
 *   • fathom_build_info{version,node_version} — static labels, value 1
 *
 * The format is intentionally raw text — no prom-client dep — so the
 * endpoint stays dependency-free and the service can be used from any
 * Express app without plumbing.
 */

import { performance } from 'node:perf_hooks';
import os from 'node:os';

const state = {
    startedAt:     Date.now(),
    httpRequests:  new Map(),  // key = `${method}|${status}` → count
    lastLoopLag:   0,
    buildVersion:  process.env.FATHOM_VERSION || 'dev',
};

/** Middleware: bumps http_requests_total counters. */
export function requestCounter() {
    return (req, res, next) => {
        res.on('finish', () => {
            const key = `${req.method}|${res.statusCode}`;
            state.httpRequests.set(key, (state.httpRequests.get(key) || 0) + 1);
        });
        next();
    };
}

/** Measure event-loop lag every N ms. Start once at boot. */
export function startEventLoopLagMonitor(periodMs = 5000) {
    let prev = performance.now();
    setInterval(() => {
        const now = performance.now();
        const expected = prev + periodMs;
        state.lastLoopLag = Math.max(0, (now - expected) / 1000); // seconds
        prev = now;
    }, periodMs).unref?.();
}

function esc(v) {
    return String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Render a metric line with optional labels. */
function metric(name, help, type, samples) {
    const lines = [
        `# HELP ${name} ${help}`,
        `# TYPE ${name} ${type}`,
    ];
    for (const s of samples) {
        const labels = s.labels && Object.keys(s.labels).length
            ? '{' + Object.entries(s.labels).map(([k, v]) => `${k}="${esc(v)}"`).join(',') + '}'
            : '';
        lines.push(`${name}${labels} ${s.value}`);
    }
    return lines.join('\n');
}

export function renderMetrics() {
    const uptime = (Date.now() - state.startedAt) / 1000;
    const mem = process.memoryUsage();

    const blocks = [
        metric('fathom_process_uptime_seconds',
               'Seconds since process start', 'gauge',
               [{ value: uptime.toFixed(3) }]),
        metric('fathom_process_memory_rss_bytes',
               'Resident set size in bytes', 'gauge',
               [{ value: mem.rss }]),
        metric('fathom_process_heap_used_bytes',
               'Heap bytes used', 'gauge',
               [{ value: mem.heapUsed }]),
        metric('fathom_event_loop_lag_seconds',
               'Event-loop lag in seconds (best-effort)', 'gauge',
               [{ value: state.lastLoopLag.toFixed(6) }]),
        metric('fathom_http_requests_total',
               'Total HTTP requests by method and status', 'counter',
               [...state.httpRequests.entries()].map(([k, v]) => {
                   const [method, status] = k.split('|');
                   return { labels: { method, status }, value: v };
               })),
        metric('fathom_build_info',
               'FATHOM build info', 'gauge',
               [{ labels: { version: state.buildVersion, node_version: process.version, host: os.hostname() }, value: 1 }]),
    ];
    return blocks.join('\n\n') + '\n';
}

/** For tests. */
export function _resetForTests() {
    state.startedAt = Date.now();
    state.httpRequests.clear();
    state.lastLoopLag = 0;
}
