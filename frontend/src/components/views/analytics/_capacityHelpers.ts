/**
 * _capacityV3Helpers.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Data generators + AI summary templates for CapacityPlanningTabV3.
 *
 * Live data now flows from the `/api/capacity/*` backend via the
 * `useCapacityData` hook at the bottom of this file. The deterministic
 * generators are retained as a fallback so the UI still renders before the
 * first snapshot exists (or if the endpoint is unavailable).
 * ────────────────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react';
import { fetchData, postData } from '../../../utils/api';
import { THEME } from '../../../utils/theme';

export interface ForecastPoint {
    day: number; // -30 … +60 relative to today
    used: number; // GB
    band?: number; // ± GB uncertainty (future only)
    alert?: string; // optional anomaly label
}

export interface TableBreakdown {
    name: string;
    sizeGB: number;
    growthPctPerWeek: number;
    rowsMillions: number;
    health: 'healthy' | 'slow' | 'hot';
    /** 8-week weekly size history (GB) for the heatmap. */
    weekly: number[];
}

export interface Scenario {
    key: 'slow' | 'current' | 'spike';
    label: string;
    multiplier: number;
    description: string;
    emoji?: string; // kept off the UI; reserved for future.
}

export interface Action {
    id: string;
    title: string;
    detail: string;
    impact: 'high' | 'med' | 'low';
    estSavingsGB: number;
    confidencePct: number;
    effortHours: number;
    category: 'archive' | 'vacuum' | 'tier' | 'alert' | 'config';
}

/* ─────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

export const STORAGE_USED_GB = 287;
export const STORAGE_TOTAL_GB = 500;
export const BASE_GROWTH_GB_PER_DAY = 2.9;
export const MONTHLY_COST_USD = 412;
export const COLD_ROW_PCT = 36; // rows older than 90 days
export const BLOAT_GB = 18;

export const SCENARIOS: Scenario[] = [
    { key: 'slow', label: 'Slow', multiplier: 0.5, description: 'Growth at 50% of current rate' },
    { key: 'current', label: 'Current', multiplier: 1.0, description: 'Growth as observed today' },
    { key: 'spike', label: 'Launch spike', multiplier: 2.0, description: 'Growth at 2× current rate' },
];

/* ─────────────────────────────────────────────────────────────────────────
 * Forecast generator — shared between chart and scenario cards.
 * ────────────────────────────────────────────────────────────────────── */

export const buildForecast = (growthMultiplier: number, days = 60): ForecastPoint[] => {
    const pts: ForecastPoint[] = [];
    // Past 30 days.
    for (let d = -30; d <= 0; d++) {
        pts.push({ day: d, used: STORAGE_USED_GB + d * BASE_GROWTH_GB_PER_DAY });
    }
    // Projected window.
    for (let d = 1; d <= days; d++) {
        const used = STORAGE_USED_GB + d * BASE_GROWTH_GB_PER_DAY * growthMultiplier;
        const band = (d / days) * 10 + 2;
        pts.push({ day: d, used, band });
    }
    // Tag a plausible anomaly at day 12 for visual interest.
    const anomaly = pts.find((p) => p.day === 12);
    if (anomaly) anomaly.alert = 'Anomaly — above trend';
    return pts;
};

export const daysUntilCapacity = (multiplier: number): number => {
    const dailyGrowth = BASE_GROWTH_GB_PER_DAY * multiplier;
    const remaining = STORAGE_TOTAL_GB - STORAGE_USED_GB;
    return remaining / dailyGrowth;
};

export const forecastAt = (days: number, multiplier: number): number =>
    STORAGE_USED_GB + days * BASE_GROWTH_GB_PER_DAY * multiplier;

/* ─────────────────────────────────────────────────────────────────────────
 * Table breakdown — deterministic, reflects the shape real data would take.
 * ────────────────────────────────────────────────────────────────────── */

const weeklyFor = (startGB: number, growthPct: number): number[] => {
    const out: number[] = [];
    let v = startGB;
    for (let i = 0; i < 8; i++) {
        v = v * (1 + growthPct / 100);
        out.push(Number(v.toFixed(1)));
    }
    return out;
};

export const TABLE_BREAKDOWN: TableBreakdown[] = [
    {
        name: 'public.events',
        sizeGB: 124,
        rowsMillions: 82,
        growthPctPerWeek: 4.1,
        health: 'hot',
        weekly: weeklyFor(86, 4.1),
    },
    {
        name: 'public.audit_log',
        sizeGB: 68,
        rowsMillions: 41,
        growthPctPerWeek: 2.3,
        health: 'slow',
        weekly: weeklyFor(57, 2.3),
    },
    {
        name: 'public.users',
        sizeGB: 31,
        rowsMillions: 12,
        growthPctPerWeek: 0.8,
        health: 'healthy',
        weekly: weeklyFor(29, 0.8),
    },
    {
        name: 'public.orders',
        sizeGB: 22,
        rowsMillions: 7.4,
        growthPctPerWeek: 1.6,
        health: 'healthy',
        weekly: weeklyFor(19, 1.6),
    },
    {
        name: 'public.line_items',
        sizeGB: 17,
        rowsMillions: 18,
        growthPctPerWeek: 1.9,
        health: 'healthy',
        weekly: weeklyFor(14, 1.9),
    },
    {
        name: 'public.sessions',
        sizeGB: 9,
        rowsMillions: 2.1,
        growthPctPerWeek: 3.2,
        health: 'hot',
        weekly: weeklyFor(7, 3.2),
    },
    {
        name: 'public.notifications',
        sizeGB: 7,
        rowsMillions: 4.8,
        growthPctPerWeek: 1.1,
        health: 'healthy',
        weekly: weeklyFor(6.3, 1.1),
    },
    {
        name: 'other',
        sizeGB: 9,
        rowsMillions: 3.3,
        growthPctPerWeek: 0.5,
        health: 'healthy',
        weekly: weeklyFor(8.7, 0.5),
    },
];

/* ─────────────────────────────────────────────────────────────────────────
 * AI action plan — ordered, each with confidence + estimated savings.
 * ────────────────────────────────────────────────────────────────────── */

export const ACTIONS: Action[] = [
    {
        id: 'a1',
        title: 'Archive events older than 90 days',
        detail: 'Move cold rows from public.events (36% of the table) to object storage. Adds ~30 days of runway on its own.',
        impact: 'high',
        estSavingsGB: 80,
        confidencePct: 92,
        effortHours: 4,
        category: 'archive',
    },
    {
        id: 'a2',
        title: 'Vacuum full on public.audit_log',
        detail: 'Runs in ~12 min during off-hours. Reclaims bloat that accumulated after a schema migration in Feb.',
        impact: 'med',
        estSavingsGB: 15,
        confidencePct: 88,
        effortHours: 1,
        category: 'vacuum',
    },
    {
        id: 'a3',
        title: 'Move snapshots to S3-compatible object storage',
        detail: 'Nightly backups currently live on the database volume. Tiering to cheaper storage adds runway and cuts monthly spend by ~$40.',
        impact: 'med',
        estSavingsGB: 25,
        confidencePct: 78,
        effortHours: 6,
        category: 'tier',
    },
    {
        id: 'a4',
        title: 'Enable BRIN on public.audit_log(created_at)',
        detail: "BRIN replaces the current B-tree (42 GB) with a ~60 MB index. Read plan doesn't regress for typical time-range queries.",
        impact: 'med',
        estSavingsGB: 42,
        confidencePct: 74,
        effortHours: 2,
        category: 'config',
    },
    {
        id: 'a5',
        title: 'Alert at 80% capacity',
        detail: 'Adds a leading indicator so the next capacity decision happens calmly, not at 2am. Wire to the existing PagerDuty route.',
        impact: 'low',
        estSavingsGB: 0,
        confidencePct: 99,
        effortHours: 0.5,
        category: 'alert',
    },
    {
        id: 'a6',
        title: 'Enable compression on public.events partitions',
        detail: 'TimescaleDB / pg_compression saves ~40% on older partitions with no app changes. Verified on the staging replica.',
        impact: 'high',
        estSavingsGB: 48,
        confidencePct: 70,
        effortHours: 5,
        category: 'config',
    },
];

/* ─────────────────────────────────────────────────────────────────────────
 * AI summary generator
 * ────────────────────────────────────────────────────────────────────── */

export interface Summary {
    headline: string;
    confidencePct: number;
    drivers: string[];
    hitDateLabel: string;
    daysUntilFull: number;
    bandDays: number;
}

export const buildSummary = (multiplier: number): Summary => {
    const days = daysUntilCapacity(multiplier);
    const dailyGrowth = BASE_GROWTH_GB_PER_DAY * multiplier;
    // Rough uncertainty: ±10% of days, clamped.
    const band = Math.max(3, Math.round(days * 0.12));
    const hitDate = new Date(Date.now() + days * 86_400_000);
    const hitLabel = hitDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    const confidencePct = multiplier === 1 ? 88 : multiplier === 0.5 ? 72 : 68;

    const drivers: string[] = [];
    const hot = TABLE_BREAKDOWN.filter((t) => t.health === 'hot');
    if (hot.length) {
        const main = hot[0];
        drivers.push(
            `${main.name} growing ${main.growthPctPerWeek}% per week — ${Math.round((main.growthPctPerWeek / 100) * main.sizeGB * 4)} GB/month on its own.`,
        );
    }
    drivers.push(`Bloat alone accounts for ~${BLOAT_GB} GB and is reversible.`);
    drivers.push(`${COLD_ROW_PCT}% of rows are older than 90 days and rarely read.`);
    drivers.push(
        `At current pace, storage crosses 80% in ${Math.round(days * 0.65)} days — flag this as your first trigger.`,
    );

    return {
        headline:
            multiplier === 1
                ? `At the current pace you'll run out of storage in about ${Math.round(days)} days (${hitLabel}), give or take ${band} days.`
                : multiplier > 1
                  ? `If traffic doubles, storage runs out in about ${Math.round(days)} days (${hitLabel}). That's tight — start the archive job now.`
                  : `If growth halves, you've got roughly ${Math.round(days)} days of runway (${hitLabel}). Good window to plan instead of react.`,
        confidencePct,
        drivers,
        hitDateLabel: hitLabel,
        daysUntilFull: days,
        bandDays: band,
    };
};

/* ─────────────────────────────────────────────────────────────────────────
 * Misc
 * ────────────────────────────────────────────────────────────────────── */

export const fmtGB = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(1)} TB` : `${v.toFixed(0)} GB`);

export const fmtDays = (v: number): string => {
    if (v >= 365) return `${(v / 365).toFixed(1)} yr`;
    if (v >= 60) return `${Math.round(v / 30)} mo`;
    return `${Math.round(v)} d`;
};

export const impactTone = (impact: Action['impact']): { color: string; label: string } => {
    // Colors are supplied by the consuming component using THEME tokens;
    // keeping this module theme-free so it stays pure.
    switch (impact) {
        case 'high':
            return { color: THEME.danger, label: 'High impact' };
        case 'med':
            return { color: THEME.warning, label: 'Medium impact' };
        case 'low':
            return { color: THEME.info, label: 'Low impact' };
        default:
            return { color: THEME.info, label: 'Low impact' };
    }
};

/* ─────────────────────────────────────────────────────────────────────────
 * Live data hook — fetches from /api/capacity/*, falls back to mock.
 * connectionId is appended automatically by utils/api.ts.
 * ────────────────────────────────────────────────────────────────────── */

export interface CapacityStats {
    usedGB: number;
    totalGB: number;
    remainingGB: number;
    pctUsed: number;
    growthGBPerDay: number;
    bloatGB: number;
    coldRowPct: number;
    daysUntilFull: number | null;
    hasHistory: boolean;
}

export interface CapacityData {
    loading: boolean;
    live: boolean;
    error: string | null;
    stats: CapacityStats;
    tables: TableBreakdown[];
    forecastPoints: ForecastPoint[] | null;
    actions: Action[];
    reload: () => void;
    snapshot: () => Promise<void>;
}

const MOCK_STATS: CapacityStats = {
    usedGB: STORAGE_USED_GB,
    totalGB: STORAGE_TOTAL_GB,
    remainingGB: STORAGE_TOTAL_GB - STORAGE_USED_GB,
    pctUsed: Number(((STORAGE_USED_GB / STORAGE_TOTAL_GB) * 100).toFixed(1)),
    growthGBPerDay: BASE_GROWTH_GB_PER_DAY,
    bloatGB: BLOAT_GB,
    coldRowPct: COLD_ROW_PCT,
    daysUntilFull: Math.round((STORAGE_TOTAL_GB - STORAGE_USED_GB) / BASE_GROWTH_GB_PER_DAY),
    hasHistory: false,
};

export function useCapacityData(days = 60): CapacityData {
    const [loading, setLoading] = useState(true);
    const [live, setLive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<CapacityStats>(MOCK_STATS);
    const [tables, setTables] = useState<TableBreakdown[]>(TABLE_BREAKDOWN);
    const [forecastPoints, setForecastPoints] = useState<ForecastPoint[] | null>(null);
    const [actions, setActions] = useState<Action[]>(ACTIONS);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [s, t, f, a] = await Promise.all([
                fetchData('/api/capacity/stats'),
                fetchData(`/api/capacity/tables?limit=8`),
                fetchData(`/api/capacity/forecast?days=${days}`),
                fetchData('/api/capacity/actions'),
            ]);
            if (s && typeof s.usedGB === 'number') {
                setStats(s);
                setLive(true);
            }
            if (t?.tables?.length) setTables(t.tables);
            if (f?.points?.length) setForecastPoints(f.points);
            if (a?.actions?.length) setActions(a.actions);
        } catch (e: any) {
            setError(e?.message || 'Failed to load capacity data');
        } finally {
            setLoading(false);
        }
    }, [days]);

    const snapshot = useCallback(async () => {
        try {
            await postData('/api/capacity/snapshot', {});
        } catch {
            /* ignore */
        }
        await load();
    }, [load]);

    useEffect(() => {
        load();
    }, [load]);

    return { loading, live, error, stats, tables, forecastPoints, actions, reload: load, snapshot };
}
