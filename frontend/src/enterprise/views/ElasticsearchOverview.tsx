// ==========================================================================
//  FATHOM — Elasticsearch Overview View
// ==========================================================================
//  Cluster-level health + per-index summary. Served by
//  /api/enterprise/elasticsearch/health + /indices.
// ==========================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { fetchData } from '../../utils/api';
import { THEME } from '../../utils/theme';
import {
    Page, PageHeader, Card, KVGrid, Muted, Alert, Table, StatusPill,
} from './_viewKit';

interface ClusterHealth {
    cluster_name: string;
    status: 'green' | 'yellow' | 'red';
    number_of_nodes: number;
    number_of_data_nodes: number;
    active_primary_shards: number;
    active_shards: number;
    relocating_shards: number;
    initializing_shards: number;
    unassigned_shards: number;
}

interface IndexRow {
    index: string;
    health: 'green' | 'yellow' | 'red';
    status: 'open' | 'close';
    docs: number;
    primaries: number;
    replicas: number;
    storeSize: string;
}

const healthColor = (h: string) =>
    h === 'green' ? THEME.success : h === 'yellow' ? THEME.warning : THEME.danger;

const ElasticsearchOverviewInner: React.FC = () => {
    const [health, setHealth] = useState<ClusterHealth | null>(null);
    const [indices, setIndices] = useState<IndexRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [h, ix] = await Promise.all([
                fetchData('/api/enterprise/elasticsearch/health'),
                fetchData('/api/enterprise/elasticsearch/indices'),
            ]);
            setHealth(h);
            setIndices(ix?.indices ?? []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load Elasticsearch data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <Page>
            <PageHeader
                icon={<Search size={18} />}
                title="Elasticsearch overview"
                subtitle="Cluster health, shard allocation, and indices"
                accent={THEME.warning}
                onRefresh={refresh}
                refreshing={loading}
            />

            {error && <Alert>{error}</Alert>}

            {health && (
                <Card
                    title="Cluster"
                    right={
                        <StatusPill
                            label={health.status}
                            color={healthColor(health.status)}
                        />
                    }
                >
                    <p
                        style={{
                            margin: '0 0 12px',
                            fontSize: 12,
                            color: THEME.textMuted,
                            fontFamily: `'JetBrains Mono', monospace`,
                        }}
                    >
                        {health.cluster_name}
                    </p>
                    <KVGrid
                        columns={2}
                        items={[
                            { label: 'Nodes', value: health.number_of_nodes, mono: true },
                            { label: 'Data nodes', value: health.number_of_data_nodes, mono: true },
                            { label: 'Active primary shards', value: health.active_primary_shards, mono: true },
                            { label: 'Active shards', value: health.active_shards, mono: true },
                            { label: 'Relocating', value: health.relocating_shards, mono: true },
                            { label: 'Initializing', value: health.initializing_shards, mono: true },
                            { label: 'Unassigned', value: health.unassigned_shards, mono: true },
                        ]}
                    />
                </Card>
            )}

            <Card title="Indices">
                {loading && indices.length === 0 ? (
                    <Muted>Loading…</Muted>
                ) : (
                    <Table
                        columns={[
                            { key: 'index', label: 'Index', mono: true },
                            { key: 'health', label: 'Health' },
                            { key: 'status', label: 'Status' },
                            { key: 'docs', label: 'Docs', align: 'right', mono: true },
                            { key: 'primaries', label: 'Primaries', align: 'right', mono: true },
                            { key: 'replicas', label: 'Replicas', align: 'right', mono: true },
                            { key: 'storeSize', label: 'Size', align: 'right', mono: true },
                        ]}
                        rows={indices.map((ix) => ({
                            index: ix.index,
                            health: (
                                <span style={{ color: healthColor(ix.health), fontWeight: 600 }}>
                                    {ix.health}
                                </span>
                            ),
                            status: ix.status,
                            docs: ix.docs,
                            primaries: ix.primaries,
                            replicas: ix.replicas,
                            storeSize: ix.storeSize,
                        }))}
                        rowKey={(r: any) => String(r.index)}
                        emptyText="No indices returned."
                    />
                )}
            </Card>
        </Page>
    );
};

const ElasticsearchOverview: React.FC = () => <ElasticsearchOverviewInner />;

export default ElasticsearchOverview;
