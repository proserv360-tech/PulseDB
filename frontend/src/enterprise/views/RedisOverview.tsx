// ==========================================================================
//  FATHOM — Redis Overview View
// ==========================================================================
//  Read-only overview of a Redis target: INFO sections, keyspace counts,
//  replication role. Data is served by /api/enterprise/redis/info.
// ==========================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Database } from 'lucide-react';
import { fetchData } from '../../utils/api';
import { THEME } from '../../utils/theme';
import {
    Page, PageHeader, Card, KV, Muted, Alert, Table,
} from './_viewKit';

interface RedisInfo {
    server: Record<string, string | number>;
    clients: Record<string, string | number>;
    memory: Record<string, string | number>;
    stats: Record<string, string | number>;
    replication: Record<string, string | number>;
    keyspace: Record<string, { keys: number; expires: number; avg_ttl: number }>;
}

const RedisOverviewInner: React.FC = () => {
    const [info, setInfo] = useState<RedisInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchData('/api/enterprise/redis/info');
            setInfo(data);
        } catch (err: any) {
            setError(err?.message || 'Failed to load Redis info');
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
                icon={<Database size={18} />}
                title="Redis overview"
                subtitle="Server health, memory, replication, and keyspace"
                accent={THEME.danger}
                onRefresh={refresh}
                refreshing={loading}
            />

            {error && <Alert>{error}</Alert>}
            {loading && !info && <Muted>Loading…</Muted>}

            {info && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 16,
                    }}
                >
                    <Card title="Server">
                        <KV label="Version" value={info.server.redis_version} mono />
                        <KV label="Uptime (s)" value={info.server.uptime_in_seconds} mono />
                        <KV label="OS" value={info.server.os} />
                    </Card>

                    <Card title="Clients">
                        <KV label="Connected" value={info.clients.connected_clients} mono />
                        <KV label="Blocked" value={info.clients.blocked_clients} mono />
                    </Card>

                    <Card title="Memory">
                        <KV label="Used" value={info.memory.used_memory_human} mono />
                        <KV label="Peak" value={info.memory.used_memory_peak_human} mono />
                        <KV label="Frag ratio" value={info.memory.mem_fragmentation_ratio} mono />
                    </Card>

                    <Card title="Replication">
                        <KV label="Role" value={info.replication.role} />
                        <KV label="Replicas" value={info.replication.connected_slaves} mono />
                    </Card>

                    <Card title="Keyspace" style={{ gridColumn: '1 / -1' }}>
                        {Object.keys(info.keyspace).length === 0 ? (
                            <Muted>No data in any DB.</Muted>
                        ) : (
                            <Table
                                columns={[
                                    { key: 'db', label: 'DB', mono: true },
                                    { key: 'keys', label: 'Keys', align: 'right', mono: true },
                                    { key: 'expires', label: 'Expires', align: 'right', mono: true },
                                    { key: 'avg_ttl', label: 'Avg TTL', align: 'right', mono: true },
                                ]}
                                rows={Object.entries(info.keyspace).map(([db, v]) => ({
                                    db,
                                    keys: v.keys,
                                    expires: v.expires,
                                    avg_ttl: v.avg_ttl,
                                }))}
                                rowKey={(r) => String(r.db)}
                            />
                        )}
                    </Card>
                </div>
            )}
        </Page>
    );
};

const RedisOverview: React.FC = () => <RedisOverviewInner />;

export default RedisOverview;
