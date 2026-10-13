// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * DynamoDBAdapter.js
 *
 * AWS DynamoDB adapter using `@aws-sdk/client-dynamodb` as a peer dependency.
 *
 * Monitoring surface:
 *   • ListTables / DescribeTable     — catalog + per-table size + throughput.
 *   • DescribeLimits                 — provisioned capacity headroom.
 *   • CloudWatch metrics             — out-of-scope here; fed by cloudwatchService.js.
 *
 * DynamoDB is a managed NoSQL KV/document store. Concepts like indexes exist
 * but are different (GSIs/LSIs). We surface them where helpful and return
 * structured "not applicable" shapes for anything that doesn't map.
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await — see MSSQLAdapter note).
let DynamoDB: any;
let _DynamoDBLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (DynamoDB !== undefined) return DynamoDB;
    if (!_DynamoDBLoading) {
        _DynamoDBLoading = (async () => {
            try {
                const moduleId = '@aws-sdk/client-dynamodb';
                const mod = await import(moduleId);
                DynamoDB = mod.DynamoDBClient || mod.default?.DynamoDBClient || mod.default;
            } catch {
                DynamoDB = null;
            }
        })();
    }
    await _DynamoDBLoading;
    return DynamoDB;
}

export class DynamoDBAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'dynamodb';
        this.client = null;
    }

    getDriverName() {
        return '@aws-sdk/client-dynamodb';
    }

    _checkDriver() {
        if (!DynamoDB) {
            throw new Error(
                'DynamoDB driver (@aws-sdk/client-dynamodb) not installed. Install with: npm install @aws-sdk/client-dynamodb',
            );
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        const cfg = this.config || {};
        this.client = new DynamoDB({
            region: cfg.region || process.env.AWS_REGION || 'us-east-1',
            credentials: cfg.credentials,
            endpoint: cfg.endpoint, // for DynamoDB-local testing
        });
        // Lazily imported commands keep this file tree-shakeable on boot.
        const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb');
        await this.client.send(new ListTablesCommand({ Limit: 1 }));
        this.connected = true;
    }

    async disconnect() {
        this.client?.destroy?.();
        this.client = null;
        this.connected = false;
    }

    async executeQuery(/* operationJson, params = [] */) {
        throw new Error(
            'DynamoDB does not execute SQL. Use PartiQL via the ExecuteStatement command, or use a per-method helper.',
        );
    }

    async getServerVersion() {
        return { engine: 'dynamodb', version: 'managed', region: this.config?.region || process.env.AWS_REGION };
    }

    async getDatabaseList() {
        // DynamoDB has no databases — tables are flat in a region.
        return [{ name: this.config?.region || process.env.AWS_REGION || 'us-east-1', kind: 'region' }];
    }

    async _listAllTables() {
        const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb');
        const names = [];
        let ExclusiveStartTableName;
        do {
            const r = await this.client.send(new ListTablesCommand({ ExclusiveStartTableName, Limit: 100 }));
            names.push(...(r.TableNames || []));
            ExclusiveStartTableName = r.LastEvaluatedTableName;
        } while (ExclusiveStartTableName);
        return names;
    }

    async getOverviewStats() {
        const names = await this._listAllTables();
        return { table_count: names.length, engine: 'dynamodb' };
    }

    async getPerformanceStats() {
        return {
            slow_queries: [],
            note: 'DynamoDB performance metrics are exposed via CloudWatch (latency, throttling). See cloudwatchService.',
        };
    }

    async getTableStats() {
        const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
        const names = await this._listAllTables();
        const results = [];
        for (const name of names.slice(0, 50)) {
            // cap to avoid API flood
            try {
                const r = await this.client.send(new DescribeTableCommand({ TableName: name }));
                const t = r.Table || {};
                results.push({
                    schema: 'default',
                    name: t.TableName,
                    rows: Number(t.ItemCount) || 0,
                    bytes: Number(t.TableSizeBytes) || 0,
                    status: t.TableStatus,
                    billing: t.BillingModeSummary?.BillingMode || 'PROVISIONED',
                });
            } catch {
                /* skip unreadable tables */
            }
        }
        return results;
    }

    async getIndexStats() {
        const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
        const names = await this._listAllTables();
        const indexes = [];
        for (const name of names.slice(0, 50)) {
            try {
                const r = await this.client.send(new DescribeTableCommand({ TableName: name }));
                for (const gsi of r.Table?.GlobalSecondaryIndexes || []) {
                    indexes.push({ table: name, index: gsi.IndexName, kind: 'GSI', status: gsi.IndexStatus });
                }
                for (const lsi of r.Table?.LocalSecondaryIndexes || []) {
                    indexes.push({ table: name, index: lsi.IndexName, kind: 'LSI' });
                }
            } catch {
                /* skip */
            }
        }
        return indexes;
    }

    // DynamoDB "connections" — stateless REST, no sessions. Substitute:
    // recent requester identities from CloudTrail. We don't plumb CloudTrail
    // here; instead we emit a well-formed placeholder that the
    // cloudwatchService consumes to fill with per-principal request counts.
    async getActiveConnections() {
        return {
            kind: 'request_principals',
            sessions: [],
            note: 'DynamoDB is stateless REST — see cloudwatchService.getDynamoPrincipals() for per-IAM-identity request counts.',
        };
    }

    // Lock-equivalent: conditional-check-failed requests. High rate = two
    // writers racing for the same item — the closest thing DynamoDB has to
    // lock contention.
    async getLockInfo() {
        // These metrics come from CloudWatch (namespace AWS/DynamoDB). We
        // surface a pointer here; the cloudwatchService owns the fetch.
        return {
            kind: 'conditional_failures',
            locks: [],
            note: 'DynamoDB has no row locks. ConditionalCheckFailedRequests (CloudWatch AWS/DynamoDB) is the analog contention signal.',
            cloudwatch_metric: { namespace: 'AWS/DynamoDB', name: 'ConditionalCheckFailedRequests' },
        };
    }

    // Global-tables replication is exposed per-table via DescribeTable.Replicas.
    async getReplicationStatus() {
        const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
        const names = await this._listAllTables();
        const replicas = [];
        for (const name of names.slice(0, 50)) {
            try {
                const r = await this.client.send(new DescribeTableCommand({ TableName: name }));
                for (const rep of r.Table?.Replicas || []) {
                    replicas.push({
                        table: name,
                        region: rep.RegionName,
                        status: rep.ReplicaStatus,
                        kms_id: rep.KMSMasterKeyId,
                        lag_sec: null, // DynamoDB doesn't expose lag here; CloudWatch ReplicationLatency is per-metric.
                    });
                }
            } catch {
                /* skip */
            }
        }
        return {
            kind: 'global_table_replicas',
            replicas,
            note: replicas.length
                ? 'Rows reflect AWS/DynamoDB Global Tables replica status per region.'
                : 'No tables have Global-Table replicas configured.',
        };
    }

    // Wait events = throttle metrics. Surfaced as pointers so the dashboard
    // pulls from CloudWatch via cloudwatchService.
    async getWaitEvents() {
        return {
            window: '1h',
            events: [
                { event: 'ReadThrottleEvents', cloudwatch: { namespace: 'AWS/DynamoDB', name: 'ReadThrottleEvents' } },
                {
                    event: 'WriteThrottleEvents',
                    cloudwatch: { namespace: 'AWS/DynamoDB', name: 'WriteThrottleEvents' },
                },
                { event: 'ThrottledRequests', cloudwatch: { namespace: 'AWS/DynamoDB', name: 'ThrottledRequests' } },
                { event: 'SystemErrors', cloudwatch: { namespace: 'AWS/DynamoDB', name: 'SystemErrors' } },
                { event: 'UserErrors', cloudwatch: { namespace: 'AWS/DynamoDB', name: 'UserErrors' } },
            ],
            note: 'DynamoDB throttle + error counters from CloudWatch — fetched by cloudwatchService.',
        };
    }

    // Bloat-equivalent: cold tables (not updated in N days) that still
    // accrue storage cost. Useful for tidy-up recommendations.
    async getBloatInfo() {
        const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
        const names = await this._listAllTables();
        const now = Date.now();
        const out = [];
        for (const name of names.slice(0, 50)) {
            try {
                const r = await this.client.send(new DescribeTableCommand({ TableName: name }));
                const t = r.Table || {};
                const created = t.CreationDateTime ? new Date(t.CreationDateTime).getTime() : now;
                const daysOld = Math.floor((now - created) / 86_400_000);
                out.push({
                    table: t.TableName,
                    bytes: Number(t.TableSizeBytes) || 0,
                    rows: Number(t.ItemCount) || 0,
                    days_old: daysOld,
                    billing: t.BillingModeSummary?.BillingMode || 'PROVISIONED',
                    cold: (Number(t.ItemCount) || 0) === 0 && daysOld > 30,
                });
            } catch {
                /* skip */
            }
        }
        return out;
    }

    // Plan-equivalent: DynamoDB has no SQL; the closest thing is the
    // "ReturnConsumedCapacity" shape you get back from an Execute.
    async getPlanForQuery(partiql) {
        const { ExecuteStatementCommand } = await import('@aws-sdk/client-dynamodb');
        try {
            const r = await this.client.send(
                new ExecuteStatementCommand({
                    Statement: partiql,
                    Limit: 1,
                    ReturnConsumedCapacity: 'INDEXES',
                }),
            );
            return {
                engine: 'dynamodb',
                consumed_capacity: r.ConsumedCapacity,
                item_count_estimate: r.Items?.length || 0,
            };
        } catch (err) {
            return { engine: 'dynamodb', error: err.message };
        }
    }

    async getKeyMetrics() {
        return await this.getOverviewStats();
    }

    /**
     * DynamoDB is a managed key-value / document store: no SQL schema, no
     * VACUUM/WAL, no EXPLAIN, no server-side locks. Partition-key based with
     * GSI/LSI secondary indexes. Query-shape history via CloudWatch
     * Contributor Insights; PITR / on-demand backups cover backup & restore.
     */
    getCapabilities() {
        return {
            ...super.getCapabilities(),
            replication: true,
            schemas: false,
            partitioning: true,
            sharding: true,
            vacuum: false,
            wal: false,
            queryPlan: false,
            explain: false,
            indexes: true,
            locks: false,
            waitEvents: true,
            queryHistory: true,
            slowQueryLog: false,
            storedProcedures: false,
            triggers: true,
            backup: true,
            restore: true,
        };
    }
}

export default DynamoDBAdapter;
