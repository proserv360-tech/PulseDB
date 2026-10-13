// ==========================================================================
//  PulseDB — Anomaly Detector Picker
// ==========================================================================
//  Per-metric detector configuration: pick between z-score, EWMA, or MAD,
//  tune the sensitivity, save per-metric. Lists current anomaly events.
//
//  Backend: services/anomaly/*.js — detector factory + evaluator.
// ==========================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Save, AlertTriangle } from 'lucide-react';
import { fetchData, postData } from '../../utils/api';
import { THEME } from '../../utils/theme';
import {
    Page, PageHeader, Card, Muted, Alert, Button, Select, Input, Table,
} from './_viewKit';

type DetectorKind = 'zscore' | 'ewma' | 'mad';

interface MetricConfig {
    metric: string;
    detector: DetectorKind;
    threshold: number;
    windowSize: number;
    enabled: boolean;
}

interface AnomalyEvent {
    id: string;
    metric: string;
    ts: string;
    value: number;
    score: number;
    detector: DetectorKind;
}

const DETECTOR_LABELS: Record<DetectorKind, string> = {
    zscore: 'Rolling z-score',
    ewma: 'EWMA (exponential weighted)',
    mad: 'MAD (median absolute deviation)',
};

const DETECTOR_HELP: Record<DetectorKind, string> = {
    zscore:
        'Simple and fast. Assumes the metric is roughly normally distributed. Good for QPS and connection-count.',
    ewma:
        'Adapts to slow trend changes. Good for metrics with time-of-day patterns.',
    mad: 'Robust to outliers. Good for latency tails.',
};

const DetectorPickerInner: React.FC = () => {
    const [configs, setConfigs] = useState<MetricConfig[]>([]);
    const [events, setEvents] = useState<AnomalyEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [c, e] = await Promise.all([
                fetchData('/api/enterprise/anomaly/configs'),
                fetchData('/api/enterprise/anomaly/events?limit=20'),
            ]);
            setConfigs(c?.configs ?? []);
            setEvents(e?.events ?? []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load anomaly data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const updateConfig = (metric: string, patch: Partial<MetricConfig>) => {
        setConfigs((prev) => prev.map((c) => (c.metric === metric ? { ...c, ...patch } : c)));
    };

    const save = async (cfg: MetricConfig) => {
        setSaving(cfg.metric);
        setError(null);
        try {
            await postData(`/api/enterprise/anomaly/configs`, cfg);
        } catch (err: any) {
            setError(err?.message || 'Save failed');
        } finally {
            setSaving(null);
        }
    };

    return (
        <Page>
            <PageHeader
                icon={<Activity size={18} />}
                title="Anomaly detectors"
                subtitle="Per-metric detector kind, threshold, and window tuning"
                accent={THEME.ai}
                onRefresh={refresh}
                refreshing={loading}
            />

            {error && <Alert>{error}</Alert>}

            <Card title="Per-metric configuration">
                {loading && configs.length === 0 ? (
                    <Muted>Loading…</Muted>
                ) : configs.length === 0 ? (
                    <Muted>No metrics are currently being tracked for anomaly detection.</Muted>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {configs.map((cfg) => (
                            <div
                                key={cfg.metric}
                                style={{
                                    border: `1px solid ${THEME.glassBorder}`,
                                    borderRadius: 10,
                                    padding: 14,
                                    background: THEME.surfaceHover,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 10,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: `'JetBrains Mono', monospace`,
                                            fontSize: 13,
                                            color: THEME.textMain,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {cfg.metric}
                                    </span>
                                    <label
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 12,
                                            color: THEME.textMuted,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={cfg.enabled}
                                            onChange={(e) =>
                                                updateConfig(cfg.metric, { enabled: e.target.checked })
                                            }
                                            style={{ accentColor: THEME.primary }}
                                            aria-label={`Enable detector for ${cfg.metric}`}
                                        />
                                        enabled
                                    </label>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Select
                                        id={`detector-${cfg.metric}`}
                                        value={cfg.detector}
                                        onChange={(e) =>
                                            updateConfig(cfg.metric, {
                                                detector: e.target.value as DetectorKind,
                                            })
                                        }
                                        aria-label="Detector kind"
                                        style={{ width: 'auto', minWidth: 140 }}
                                    >
                                        <option value="zscore">z-score</option>
                                        <option value="ewma">EWMA</option>
                                        <option value="mad">MAD</option>
                                    </Select>
                                    <Input
                                        id={`threshold-${cfg.metric}`}
                                        type="number"
                                        step="0.1"
                                        value={cfg.threshold}
                                        onChange={(e) =>
                                            updateConfig(cfg.metric, {
                                                threshold: Number(e.target.value),
                                            })
                                        }
                                        placeholder="threshold"
                                        aria-label="Threshold"
                                        style={{ width: 110 }}
                                    />
                                    <Input
                                        id={`window-${cfg.metric}`}
                                        type="number"
                                        value={cfg.windowSize}
                                        onChange={(e) =>
                                            updateConfig(cfg.metric, {
                                                windowSize: Number(e.target.value),
                                            })
                                        }
                                        placeholder="window"
                                        aria-label="Window size"
                                        style={{ width: 110 }}
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        disabled={saving === cfg.metric}
                                        onClick={() => save(cfg)}
                                        ariaLabel={`Save detector config for ${cfg.metric}`}
                                        style={{ marginLeft: 'auto' }}
                                    >
                                        <Save size={12} />
                                        {saving === cfg.metric ? 'Saving…' : 'Save'}
                                    </Button>
                                </div>

                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: THEME.textMuted,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    <strong style={{ color: THEME.textMain }}>
                                        {DETECTOR_LABELS[cfg.detector]}
                                    </strong>{' '}
                                    — {DETECTOR_HELP[cfg.detector]}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card
                title="Recent anomalies"
                right={
                    <AlertTriangle
                        size={14}
                        color={THEME.warning}
                        style={{ flexShrink: 0 }}
                    />
                }
            >
                <Table
                    columns={[
                        { key: 'ts', label: 'Time' },
                        { key: 'metric', label: 'Metric', mono: true },
                        { key: 'detector', label: 'Detector' },
                        { key: 'value', label: 'Value', align: 'right', mono: true },
                        { key: 'score', label: 'Score', align: 'right', mono: true },
                    ]}
                    rows={events.map((ev) => ({
                        ts: ev.ts,
                        metric: ev.metric,
                        detector: ev.detector,
                        value: ev.value,
                        score: ev.score.toFixed(2),
                    }))}
                    rowKey={(r: any, idx: number) => events[idx]?.id ?? String(idx)}
                    emptyText="No anomalies in the last window."
                />
            </Card>
        </Page>
    );
};

const DetectorPicker: React.FC = () => <DetectorPickerInner />;

export default DetectorPicker;
