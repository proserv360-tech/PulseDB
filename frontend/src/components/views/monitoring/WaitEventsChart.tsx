/**
 * components/views/monitoring/WaitEventsChart.tsx
 * A3 — Wait-event stacked-area chart.
 *
 * Renders the 5-minute rollups from /api/observability/wait-events as a
 * stacked area by wait class (CPU, IO, Lock, IPC, Client, BufferPin,
 * Activity, Other). Drop into PerformanceTab when the wait-event sampler
 * is enabled on the connection.
 */

import { useMemo } from 'react';
import { useApiQuery } from '../../../hooks/useApi';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { THEME } from '../../../utils/theme';

type Rollup = { bucket_start: string; wait_class: string; sample_count: number };

const CLASS_COLORS: Record<string, string> = {
    CPU: THEME.primaryDark,
    IO: THEME.infoDark,
    Lock: THEME.dangerDark,
    IPC: THEME.aiDark,
    Client: THEME.textDim,
    BufferPin: THEME.warning,
    Activity: THEME.success,
    Other: THEME.textDim,
};

const CLASS_ORDER = ['CPU', 'IO', 'Lock', 'IPC', 'BufferPin', 'Activity', 'Client', 'Other'];

export interface WaitEventsChartProps {
    connectionId: string | number;
    rangeMinutes?: number; // default 60
    height?: number; // default 280
}

export default function WaitEventsChart({ connectionId, rangeMinutes = 60, height = 280 }: WaitEventsChartProps) {
    // Round the window end to the current minute so the query key is stable
    // across renders (a raw Date.now() would change the key every render).
    const url = useMemo(() => {
        const to = new Date(Math.floor(Date.now() / 60_000) * 60_000);
        const from = new Date(to.getTime() - rangeMinutes * 60_000);
        return (
            `/api/observability/wait-events?connectionId=${encodeURIComponent(String(connectionId))}` +
            `&from=${from.toISOString()}&to=${to.toISOString()}&bucket=5m`
        );
    }, [connectionId, rangeMinutes]);

    const {
        data: payload,
        isLoading: loading,
        error,
    } = useApiQuery<{ rollups?: Rollup[] }>(url, {
        refetchInterval: 60_000,
    });
    const rollups = payload?.rollups ?? [];

    // Reshape: one row per bucket_start, columns = wait classes.
    const data = useMemo(() => {
        const byBucket = new Map<string, Record<string, number | string>>();
        for (const r of rollups) {
            const ts = new Date(r.bucket_start).getTime();
            const key = String(ts);
            if (!byBucket.has(key)) byBucket.set(key, { ts, label: new Date(ts).toLocaleTimeString() });
            byBucket.get(key)![r.wait_class] = Number(byBucket.get(key)![r.wait_class] || 0) + Number(r.sample_count);
        }
        return Array.from(byBucket.values()).sort((a, b) => Number(a.ts) - Number(b.ts));
    }, [rollups]);

    if (loading) return <div style={{ padding: 16, color: THEME.textDim }}>Loading wait events…</div>;
    if (error) return <div style={{ padding: 16, color: THEME.dangerDark }}>Wait events failed: {error.message}</div>;
    if (data.length === 0)
        return (
            <div style={{ padding: 16, color: THEME.textDim }}>
                No wait-event samples in the last {rangeMinutes} minutes. Sampling may not be enabled, or this
                connection has been idle.
            </div>
        );

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke={THEME.bgAlt} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {CLASS_ORDER.map((cls) => (
                        <Area
                            key={cls}
                            type="monotone"
                            dataKey={cls}
                            stackId="1"
                            stroke={CLASS_COLORS[cls]}
                            fill={CLASS_COLORS[cls]}
                            fillOpacity={0.55}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
