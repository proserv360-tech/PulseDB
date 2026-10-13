/**
 * CloudInsightsPanel.tsx
 * ──────────────────────
 * Cloud-managed DB insights status + MongoDB Atlas discovery picker.
 * - Shows AWS (RDS/Aurora) and Atlas configuration status.
 * - Lists Atlas clusters and processes (host:port) so the user picks a
 *   process instead of hand-entering it; selecting one bubbles up via
 *   onSelectProcess so the parent can store it as the credential's processId.
 *
 * Drop-in: <CloudInsightsPanel onSelectProcess={(p) => ...} />
 */
import { useEffect, useState } from 'react';
import { fetchDataFresh } from '../../../utils/api';
import { THEME, useAdaptiveTheme } from '../../../utils/theme';
import { Cloud, RefreshCw, CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';

type AwsStatus = { source?: string; configured: boolean; region?: string | null; dbIdentifier?: string | null };
type AtlasStatus = { configured: boolean; projectId?: string | null; processId?: string | null };
type AtlasProcess = {
    id: string;
    hostname?: string;
    port?: number;
    typeName?: string;
    replicaSetName?: string | null;
    version?: string | null;
};
type AtlasCluster = {
    name: string;
    clusterType?: string;
    mongoDBVersion?: string | null;
    paused?: boolean;
    stateName?: string | null;
};

/** Pure: group processes under their replica set / cluster for display. */
export function groupProcessesByReplicaSet(
    procs: AtlasProcess[],
): Array<{ replicaSet: string; processes: AtlasProcess[] }> {
    const map = new Map<string, AtlasProcess[]>();
    for (const p of procs || []) {
        const key = p.replicaSetName || '(standalone)';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(p);
    }
    return [...map.entries()]
        .map(([replicaSet, processes]) => ({ replicaSet, processes }))
        .sort((a, b) => a.replicaSet.localeCompare(b.replicaSet));
}

const Pill = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <span
        style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 999,
            color: ok ? THEME.success : THEME.textMuted,
            background: ok ? '#34d39918' : THEME.glassBorder,
            border: `1px solid ${ok ? '#34d39944' : THEME.glassBorder}`,
        }}
    >
        {ok ? <CheckCircle2 size={13} /> : <MinusCircle size={13} />} {children}
    </span>
);

export default function CloudInsightsPanel({ onSelectProcess }: { onSelectProcess?: (p: AtlasProcess) => void }) {
    useAdaptiveTheme();
    const [aws, setAws] = useState<AwsStatus | null>(null);
    const [atlas, setAtlas] = useState<AtlasStatus | null>(null);
    const [clusters, setClusters] = useState<AtlasCluster[]>([]);
    const [processes, setProcesses] = useState<AtlasProcess[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [a, t] = await Promise.all([
                fetchDataFresh('/api/cloud/aws/status').catch(() => null),
                fetchDataFresh('/api/cloud/atlas/status').catch(() => null),
            ]);
            setAws(a as AwsStatus);
            setAtlas(t as AtlasStatus);
            if ((t as AtlasStatus)?.configured) {
                const [cl, pr] = await Promise.all([
                    fetchDataFresh('/api/cloud/atlas/clusters').catch(() => ({ clusters: [] })),
                    fetchDataFresh('/api/cloud/atlas/processes').catch(() => ({ processes: [] })),
                ]);
                setClusters((cl as any).clusters || []);
                setProcesses((pr as any).processes || []);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load cloud insights');
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load(); /* eslint-disable-next-line */
    }, []);

    const card = (children: React.ReactNode) => (
        <div
            style={{
                background: THEME.surface,
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 14,
                padding: 20,
                marginBottom: 18,
                fontFamily: THEME.fontBody,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Cloud size={17} color={THEME.primary} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: THEME.textMain }}>
                        Cloud-managed DB insights
                    </div>
                </div>
                <button
                    onClick={load}
                    title="Refresh"
                    style={{
                        background: 'none',
                        border: `1px solid ${THEME.glassBorder}`,
                        borderRadius: 8,
                        padding: 6,
                        cursor: 'pointer',
                        color: THEME.textMuted,
                        display: 'flex',
                    }}
                >
                    <RefreshCw size={13} style={loading ? { animation: 'rotation 1s linear infinite' } : undefined} />
                </button>
            </div>
            {children}
        </div>
    );

    if (loading) {
        return card(
            <div style={{ padding: 20, textAlign: 'center', color: THEME.textMuted, fontSize: 13 }}>
                Loading cloud insights…
            </div>,
        );
    }
    if (error) {
        return card(
            <div style={{ padding: 14, color: THEME.danger, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={15} /> {error}
            </div>,
        );
    }

    const groups = groupProcessesByReplicaSet(processes);
    const section = (title: string, body: React.ReactNode) => (
        <div
            style={{
                border: `1px solid ${THEME.glassBorder}`,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 12,
            }}
        >
            <div style={{ fontSize: 13.5, fontWeight: 700, color: THEME.textMain, marginBottom: 8 }}>{title}</div>
            {body}
        </div>
    );

    return card(
        <>
            {section(
                'Amazon RDS / Aurora',
                aws?.configured ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Pill ok>Connected</Pill>
                        <span style={{ fontSize: 12.5, color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                            {[aws.region, aws.dbIdentifier, aws.source].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Pill ok={false}>Not configured</Pill>
                        <span style={{ fontSize: 12.5, color: THEME.textMuted }}>
                            Add AWS credentials to pull CloudWatch metrics.
                        </span>
                    </div>
                ),
            )}

            {section(
                'MongoDB Atlas',
                !atlas?.configured ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Pill ok={false}>Not configured</Pill>
                        <span style={{ fontSize: 12.5, color: THEME.textMuted }}>
                            Add an Atlas API key + project id.
                        </span>
                    </div>
                ) : (
                    <>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexWrap: 'wrap',
                                marginBottom: 10,
                            }}
                        >
                            <Pill ok>Project {atlas.projectId}</Pill>
                            {atlas.processId && (
                                <span style={{ fontSize: 12.5, color: THEME.textMuted, fontFamily: THEME.fontMono }}>
                                    process {atlas.processId}
                                </span>
                            )}
                        </div>
                        {clusters.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                                {clusters.map((c) => (
                                    <div
                                        key={c.name}
                                        style={{ fontSize: 12.5, color: THEME.textMain, fontFamily: THEME.fontMono }}
                                    >
                                        <strong>{c.name}</strong>
                                        <span style={{ color: THEME.textMuted }}>
                                            {' '}
                                            · {c.clusterType}
                                            {c.mongoDBVersion ? ` · v${c.mongoDBVersion}` : ''}
                                            {c.paused ? ' · paused' : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: THEME.textMain, margin: '6px 0 8px' }}>
                            Pick a process to monitor
                        </div>
                        {groups.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: THEME.textMuted }}>No processes found.</div>
                        ) : (
                            groups.map((g) => (
                                <div key={g.replicaSet} style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>
                                        {g.replicaSet}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {g.processes.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => onSelectProcess?.(p)}
                                                style={{
                                                    fontSize: 12,
                                                    fontFamily: THEME.fontMono,
                                                    color: THEME.textMain,
                                                    background: `${THEME.primary}10`,
                                                    border: `1px solid ${THEME.glassBorder}`,
                                                    borderRadius: 8,
                                                    padding: '5px 10px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {p.id}
                                                {p.typeName ? ` · ${p.typeName}` : ''}
                                                {p.version ? ` · v${p.version}` : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                ),
            )}
        </>,
    );
}
