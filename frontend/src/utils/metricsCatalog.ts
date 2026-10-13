/* ═══════════════════════════════════════════════════════════════════════════
   metricsCatalog.ts

   Shared types + helpers for the per-engine metric catalogs.

   A "metric catalog" is a flat list of Metric objects for one database engine.
   Each metric is tagged with a section (e.g. "Performance") so the catalog can
   be projected into the sidebar's section navigation, and also has a tier
   ("basic" | "intermediate" | "advanced") so users can filter from quick view
   to deep dives.

   The numeric values + 24-point sparklines are generated deterministically
   per metric id so the demos look "live" but stay consistent across reloads.
   ═══════════════════════════════════════════════════════════════════════════ */

export type MetricTier = 'basic' | 'intermediate' | 'advanced';

export interface Metric {
    /** Stable id, used as React key & as the seed for deterministic mock data. */
    id: string;
    /** Display name shown on the KPI card. */
    label: string;
    /** Short one-liner shown on hover / in the expanded chart card. */
    description: string;
    /** The sidebar section this metric belongs to. Drives section nav. */
    section: string;
    /** Engine-specific subsystem / source DMV / pg_stat view / system table. */
    source?: string;
    /** Unit suffix (e.g. "%", "ms", "MB", "ops/s"). Empty string for unitless. */
    unit: string;
    /** Severity / staleness tier — controls default filtering. */
    tier: MetricTier;
    /** Freeform search tags so the global search matches synonyms. */
    tags?: string[];
    /** Optional formatter override for the value display (e.g. format bytes). */
    format?: 'number' | 'percent' | 'bytes' | 'duration' | 'currency' | 'count';
    /** Optional palette override; otherwise the section's color is used. */
    color?: string;
    /** Optional value-band thresholds for trend up/down semantics. */
    higherIsBetter?: boolean;
    /** Approx range of values (used to seed mock generator); defaults below. */
    baseValue?: number;
    range?: number;
}

export interface MetricSection {
    key: string;
    label: string;
    /** Lucide icon name for the section header. */
    icon?: string;
    /** Display order in the sidebar. */
    order?: number;
    color?: string;
}

export interface MetricCatalog {
    engineId: string;       // 'demo-mssql', 'demo-oracle', etc.
    engineLabel: string;    // 'Microsoft SQL Server'
    accentColor: string;
    sections: MetricSection[];
    metrics: Metric[];
}

/* ──────────────────────────────────────────────────────────────────────────
   Deterministic mock data generators
   ────────────────────────────────────────────────────────────────────────── */

function strHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}

function seededRand(seed: number): number {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/** Returns a 24-point sparkline seeded by the metric id. */
export function makeSparkline(metricId: string, base?: number, span?: number): number[] {
    const seed = strHash(metricId);
    const b = base ?? 50 + (seed % 50);
    const s = span ?? 15 + (seed % 35);
    return Array.from({ length: 24 }, (_, i) =>
        Math.round(b + (seededRand(seed + i) - 0.5) * s * 2),
    );
}

/** Returns a stable mock numeric value for a metric. */
export function mockValue(metric: Metric): number {
    const seed = strHash(metric.id);
    const base = metric.baseValue ?? 50 + (seed % 50);
    const range = metric.range ?? base * 0.5;
    return Math.round((base + (seededRand(seed) - 0.5) * range) * 100) / 100;
}

/** Returns a stable "delta vs last hour" string e.g. "+12" or "-2.3%". */
export function mockTrend(metric: Metric): { text: string; up: boolean } {
    const seed = strHash(metric.id + '_trend');
    const up = (seed % 2) === 0;
    const pct = ((seed % 80) / 10).toFixed(1);
    const sign = up ? '+' : '-';
    return { text: `${sign}${pct}%`, up };
}

/** Pretty-print a value according to its format hint. */
export function formatValue(metric: Metric, raw: number): string {
    switch (metric.format) {
        case 'percent':
            return `${raw.toFixed(1)}%`;
        case 'bytes': {
            const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            let i = 0;
            let v = raw;
            while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
            return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)} ${units[i]}`;
        }
        case 'duration': {
            if (raw < 1)        return `${(raw * 1000).toFixed(0)} μs`;
            if (raw < 1000)     return `${raw.toFixed(1)} ms`;
            if (raw < 60_000)   return `${(raw / 1000).toFixed(2)} s`;
            return `${(raw / 60_000).toFixed(1)} min`;
        }
        case 'currency':
            return `$${raw.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        case 'count':
            return raw.toLocaleString();
        case 'number':
        default:
            if (Math.abs(raw) >= 1_000_000) return `${(raw / 1_000_000).toFixed(2)}M`;
            if (Math.abs(raw) >= 1_000)     return `${(raw / 1_000).toFixed(1)}k`;
            return raw.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
}

/** Filter metrics by free-text search across label / id / tags / section. */
export function filterMetrics(metrics: Metric[], query: string): Metric[] {
    const q = query.trim().toLowerCase();
    if (!q) return metrics;
    return metrics.filter((m) => {
        if (m.label.toLowerCase().includes(q)) return true;
        if (m.id.toLowerCase().includes(q)) return true;
        if (m.section.toLowerCase().includes(q)) return true;
        if (m.description.toLowerCase().includes(q)) return true;
        if (m.source && m.source.toLowerCase().includes(q)) return true;
        if (m.tags && m.tags.some((t) => t.toLowerCase().includes(q))) return true;
        return false;
    });
}

/** Group a metric list by section, in section.order. */
export function groupBySection(
    catalog: MetricCatalog,
    metrics: Metric[],
): Array<{ section: MetricSection; metrics: Metric[] }> {
    const bySection = new Map<string, Metric[]>();
    for (const m of metrics) {
        const list = bySection.get(m.section) || [];
        list.push(m);
        bySection.set(m.section, list);
    }
    const ordered = [...catalog.sections]
        .filter((s) => bySection.has(s.key))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    return ordered.map((section) => ({
        section,
        metrics: bySection.get(section.key) || [],
    }));
}
