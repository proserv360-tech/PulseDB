// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * MongoDBAdapter.js
 *
 * MongoDB-specific adapter using the official mongodb driver.
 * Note: The mongodb package should be added to dependencies.
 *
 * Comprehensive Monitoring Support:
 * - serverStatus: server-level statistics and counters
 * - dbStats: database-level statistics
 * - collStats: collection-level statistics with index info
 * - currentOp: active operations monitoring
 * - replSetGetStatus: replication status and lag calculation
 * - system.profile: slow query tracking
 * - $indexStats: index usage statistics
 * - serverStatus.locks: lock contention analysis
 * - serverStatus.opLatencies: read/write/command latency histograms
 */

import { BaseAdapter } from './BaseAdapter.js';

// Lazy driver load (was a top-level await, which made importing this
// module — and therefore server boot — pay the driver's full load cost
// even when no mongodb connection exists; brutal for serverless cold starts).
let mongodb: any;
let _mongodbLoading: Promise<any> | null = null;
async function ensureDriver() {
    if (mongodb !== undefined) return mongodb;
    if (!_mongodbLoading) {
        _mongodbLoading = import('mongodb').then(
            (m) => (mongodb = m),
            () => (mongodb = null),
        );
    }
    await _mongodbLoading;
    return mongodb;
}

export class MongoDBAdapter extends BaseAdapter {
    constructor(config) {
        super(config);
        this.dbType = 'mongodb';
        this.client = null;
        this.db = null;
    }

    getDriverName() {
        return 'MongoDB';
    }

    _checkDriver() {
        if (!mongodb) {
            throw new Error('MongoDB driver (mongodb) not installed. Install with: npm install mongodb');
        }
    }

    async connect() {
        await ensureDriver();
        this._checkDriver();
        try {
            const MongoClient = mongodb.MongoClient;
            const url = this._buildConnectionString();

            this.client = new MongoClient(url, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            });

            await this.client.connect();
            this.db = this.client.db(this.config.database || 'admin');
            this.connected = true;
        } catch (error) {
            throw new Error(`MongoDB connection failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            this.connected = false;
        }
    }

    _buildConnectionString() {
        if (this.config.connectionString) {
            return this.config.connectionString;
        }

        const user = this.config.user ? `${this.config.user}:${this.config.password || ''}@` : '';
        const host = this.config.host || 'localhost';
        const port = this.config.port || 27017;
        const database = this.config.database || 'admin';

        return `mongodb://${user}${host}:${port}/${database}`;
    }

    async getOverviewStats() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const dbStats = await this.db.stats();

            const connections = serverStatus.connections || {};
            const opcounters = serverStatus.opcounters || {};
            const uptime = serverStatus.uptime || 0;

            const txnRate =
                uptime > 0
                    ? ((opcounters.insert || 0) + (opcounters.update || 0) + (opcounters.delete || 0)) / uptime
                    : 0;

            return {
                activeConnections: this.toNumber(connections.current, 0),
                totalConnections: this.toNumber(connections.available, 0),
                dbSizeBytes: this.toNumber(dbStats.dataSize, 0) + this.toNumber(dbStats.indexSize, 0),
                uptimeSeconds: this.toNumber(uptime),
                version: serverStatus.version || 'Unknown',
                cacheHitRatio: this._calculateCacheHitRatio(serverStatus),
                transactionsPerSec: this.round(txnRate),
                tuplesInserted: this.toNumber(opcounters.insert),
                tuplesUpdated: this.toNumber(opcounters.update),
                tuplesDeleted: this.toNumber(opcounters.delete),
                tuplesFetched: this.toNumber(opcounters.query),
            };
        } catch (error) {
            throw new Error(`Failed to get overview stats: ${error.message}`);
        }
    }

    async getPerformanceStats() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const currentOp = await this.db.admin().command({ currentOp: 1 });

            const opcounters = serverStatus.opcounters || {};
            const uptime = serverStatus.uptime || 1;
            const txnRate = ((opcounters.insert || 0) + (opcounters.update || 0) + (opcounters.delete || 0)) / uptime;

            const activeOps = (currentOp.inprog || []).filter((op) => op.active === true).length;
            const waitingOps = (currentOp.inprog || []).filter((op) => op.waitingForLock === true).length;

            return {
                avgQueryTimeMs: this.toNumber(serverStatus.operationTime ? serverStatus.operationTime.getTime() : 0),
                activeQueries: activeOps,
                queriesWaiting: waitingOps,
                cacheHitRatio: this._calculateCacheHitRatio(serverStatus),
            };
        } catch (error) {
            throw new Error(`Failed to get performance stats: ${error.message}`);
        }
    }

    async getTableStats() {
        try {
            const collections = await this.db.listCollections().toArray();
            const stats = [];

            for (const coll of collections) {
                try {
                    const collStats = await this.db.command({
                        collStats: coll.name,
                        verbose: true,
                    });

                    stats.push({
                        schema: 'default',
                        name: coll.name,
                        rowEstimate: this.toNumber(collStats.count, 0),
                        totalSizeBytes: this.toNumber(collStats.totalSize, 0),
                        tableSizeBytes: this.toNumber(collStats.size, 0),
                        indexSizeBytes: this.toNumber(collStats.totalIndexSize, 0),
                        deadTuples: 0,
                        lastVacuum: null,
                        lastAutovacuum: null,
                        lastAnalyze: null,
                        lastAutoanalyze: null,
                        avgObjSize: this.toNumber(collStats.avgObjSize, 0),
                        capped: Boolean(collStats.capped),
                        maxDocSize: this.toNumber(collStats.max, null),
                        docValidation: Boolean(collStats.validationLevel && collStats.validationLevel !== 'off'),
                    });
                } catch (error) {
                    console.error(`Error getting stats for collection ${coll.name}:`, error.message);
                }
            }

            return stats;
        } catch (error) {
            throw new Error(`Failed to get table stats: ${error.message}`);
        }
    }

    /**
     * WiredTiger reclaimable-space signal for the storage advisor.
     * `freeStorageSize` (MongoDB 4.4+) is disk space held by the collection's
     * tablespace but free for reuse; `compact` returns it to the filesystem.
     * Normalized to the shape storageAdvisorService.analyzeFragmentation wants.
     */
    async getFragmentation() {
        const dbName = (this.db && this.db.databaseName) || this.config?.database || 'admin';
        const collections = await this.db.listCollections().toArray();
        const rows = [];
        for (const coll of collections) {
            try {
                const s = await this.db.command({ collStats: coll.name });
                const storageSize = this.toNumber(s.storageSize, 0);
                let freeStorage = this.toNumber(s.freeStorageSize, 0);
                if (!freeStorage && s.wiredTiger && s.wiredTiger['block-manager']) {
                    freeStorage = this.toNumber(s.wiredTiger['block-manager']['file bytes available for reuse'], 0);
                }
                if (freeStorage <= 0) continue;
                rows.push({
                    schema: dbName,
                    name: coll.name,
                    rowEstimate: this.toNumber(s.count, 0),
                    dataLengthBytes: Math.max(0, storageSize - freeStorage),
                    indexLengthBytes: this.toNumber(s.totalIndexSize, 0),
                    dataFreeBytes: freeStorage,
                });
            } catch (error) {
                console.error(`Error getting fragmentation for ${coll.name}:`, error.message);
            }
        }
        return rows;
    }

    async getIndexStats() {
        try {
            const collections = await this.db.listCollections().toArray();
            const stats = [];

            for (const coll of collections) {
                try {
                    const collection = this.db.collection(coll.name);
                    const indexes = await collection.indexes();

                    // Try to get $indexStats aggregation data
                    let indexStats = {};
                    try {
                        const indexStatsPipeline = [{ $indexStats: {} }];
                        const indexStatsResult = await collection.aggregate(indexStatsPipeline).toArray();

                        for (const stat of indexStatsResult) {
                            if (stat.name) {
                                indexStats[stat.name] = {
                                    accesses: this.toNumber(stat.accesses?.ops, 0),
                                    lastAccess: stat.accesses?.last || null,
                                };
                            }
                        }
                    } catch (e) {
                        // $indexStats not available in standalone or older versions
                    }

                    for (const idx of indexes) {
                        const stats_data = indexStats[idx.name] || { accesses: 0, lastAccess: null };
                        stats.push({
                            schema: 'default',
                            table: coll.name,
                            name: idx.name,
                            sizeBytes: 0,
                            scans: stats_data.accesses,
                            rowsRead: 0,
                            rowsFetched: 0,
                            lastAccess: stats_data.lastAccess,
                            indexSpec: JSON.stringify(idx.key),
                        });
                    }
                } catch (error) {
                    console.error(`Error getting indexes for collection ${coll.name}:`, error.message);
                }
            }

            return stats;
        } catch (error) {
            throw new Error(`Failed to get index stats: ${error.message}`);
        }
    }

    async getActiveConnections() {
        try {
            const currentOp = await this.db.admin().command({ currentOp: 1 });
            const connections = [];

            const ops = currentOp.inprog || [];
            for (const op of ops) {
                if (op.active && op.operation) {
                    connections.push({
                        pid: this.toNumber(op.opid, 0),
                        user: op.user || 'unknown',
                        database: op.ns?.split('.')[0] || this.config.database || 'admin',
                        state: op.waitingForLock ? 'waiting' : 'active',
                        query: op.command ? JSON.stringify(op.command) : op.operation,
                        durationSeconds: this.toNumber(op.secs_running, 0),
                        clientAddr: op.client || null,
                    });
                }
            }

            return connections;
        } catch (error) {
            return [];
        }
    }

    async getLockInfo() {
        try {
            const currentOp = await this.db.admin().command({ currentOp: 1 });
            const locks = [];

            const ops = currentOp.inprog || [];
            const waitingOps = ops.filter((op) => op.waitingForLock === true);

            for (const waitOp of waitingOps) {
                locks.push({
                    blockedPid: this.toNumber(waitOp.opid, 0),
                    blockingPid: null,
                    blockingUser: null,
                    blockedQuery: waitOp.operation,
                    blockingQuery: null,
                    lockMode: 'exclusive',
                });
            }

            return locks;
        } catch (error) {
            return [];
        }
    }

    async getReplicationStatus() {
        try {
            const replicaStatus = await this.db.admin().command({ replSetGetStatus: 1 });

            if (!replicaStatus || !replicaStatus.members) {
                return {
                    isReplica: false,
                    replicaAppName: null,
                    maxReplicationLagMb: 0,
                    replicaCount: 0,
                    replicationLagSeconds: 0,
                    oplogWindowHours: 0,
                    electionCount: 0,
                };
            }

            const members = replicaStatus.members;
            const primaryMember = members.find((m) => m.state === 1);
            const secondaryMembers = members.filter((m) => m.state === 2);

            // Calculate actual replication lag from optime differences
            let maxLagSeconds = 0;
            if (primaryMember && secondaryMembers.length > 0) {
                const primaryOptime = primaryMember.optime?.ts;
                for (const secondary of secondaryMembers) {
                    const secondaryOptime = secondary.optime?.ts;
                    if (primaryOptime && secondaryOptime) {
                        const lagSeconds = (primaryOptime.getTime() - secondaryOptime.getTime()) / 1000;
                        maxLagSeconds = Math.max(maxLagSeconds, lagSeconds);
                    }
                }
            }

            // Try to get oplog window
            let oplogWindowHours = 0;
            try {
                const localDb = this.client.db('local');
                const oplogCollection = localDb.collection('oplog.rs');
                const oplogStats = await localDb.command({ collStats: 'oplog.rs' });
                if (oplogStats && oplogStats.count > 1) {
                    const firstEntry = await oplogCollection.findOne({}, { sort: { ts: 1 } });
                    const lastEntry = await oplogCollection.findOne({}, { sort: { ts: -1 } });
                    if (firstEntry && lastEntry) {
                        const oplogWindow = (lastEntry.ts.getTime() - firstEntry.ts.getTime()) / 1000 / 3600;
                        oplogWindowHours = this.round(oplogWindow, 2);
                    }
                }
            } catch (e) {
                // Unable to determine oplog window
            }

            return {
                isReplica: primaryMember ? true : false,
                replicaAppName: primaryMember ? primaryMember.name : null,
                maxReplicationLagMb: maxLagSeconds > 1024 ? maxLagSeconds / 1024 : 0,
                replicationLagSeconds: this.round(maxLagSeconds, 2),
                replicaCount: secondaryMembers.length,
                oplogWindowHours,
                electionCount: this.toNumber(replicaStatus.term, 0),
            };
        } catch (error) {
            return {
                isReplica: false,
                replicaAppName: null,
                maxReplicationLagMb: 0,
                replicaCount: 0,
                replicationLagSeconds: 0,
                oplogWindowHours: 0,
                electionCount: 0,
            };
        }
    }

    async getDatabaseList() {
        try {
            const adminDb = this.client.db('admin');
            const dbList = await adminDb.admin().listDatabases();

            return (dbList.databases || []).map((db) => ({
                name: db.name,
                sizeBytes: this.toNumber(db.sizeOnDisk, 0),
                isTemplate: false,
                connections: 0,
            }));
        } catch (error) {
            return [];
        }
    }

    async getServerVersion() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const versionStr = serverStatus.version || 'Unknown';

            const parts = versionStr.split('.');
            const major = parseInt(parts[0], 10) || 0;
            const minor = parseInt(parts[1], 10) || 0;

            return {
                version: versionStr,
                versionNum: major * 10000 + minor * 100,
                major,
                minor,
                dbType: 'mongodb',
            };
        } catch (error) {
            return {
                version: 'Unknown',
                versionNum: 0,
                major: 0,
                minor: 0,
                dbType: 'mongodb',
            };
        }
    }

    async executeQuery(sql) {
        // MongoDB doesn't use SQL — this is a simplified stub
        const startTime = Date.now();
        const rows = [];
        const duration = Date.now() - startTime;

        return {
            rows,
            fields: [],
            rowCount: 0,
            duration,
        };
    }

    /**
     * Get comprehensive server status with all sections parsed
     */
    async getServerStatus() {
        try {
            const serverStatus = await this.db.admin().serverStatus();

            return {
                host: serverStatus.host,
                version: serverStatus.version,
                uptime: this.toNumber(serverStatus.uptime, 0),
                connections: serverStatus.connections || {},
                opcounters: serverStatus.opcounters || {},
                opcountersRepl: serverStatus.opcountersRepl || {},
                wiredTiger: serverStatus.wiredTiger || {},
                network: serverStatus.network || {},
                mem: serverStatus.mem || {},
                metrics: serverStatus.metrics || {},
                locks: serverStatus.locks || {},
                globalLock: serverStatus.globalLock || {},
            };
        } catch (error) {
            throw new Error(`Failed to get server status: ${error.message}`);
        }
    }

    /**
     * Get WiredTiger storage engine statistics
     */
    async getWiredTigerStats() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const wt = serverStatus.wiredTiger || {};
            const cache = wt.cache || {};

            const totalBytes = this.toNumber(cache.bytes_allocated, 0);
            const usedBytes = this.toNumber(cache.bytes_allocated_percent, 0);
            const dirtyPercent = totalBytes > 0 ? (this.toNumber(cache.bytes_dirty, 0) / totalBytes) * 100 : 0;

            const pagesRequested = this.toNumber(cache.pages_requested_from_cache, 1);
            const pagesRead = this.toNumber(cache.pages_read_into_cache, 1);
            const hitRatio = pagesRequested > 0 ? ((pagesRequested - pagesRead) / pagesRequested) * 100 : 0;

            return {
                cacheSizeBytes: this.toNumber(cache.maximum_bytes_configured, 0),
                cacheUsedBytes: usedBytes,
                cacheUsedPercent: this.round(this.toNumber(cache.bytes_allocated_percent, 0), 2),
                dirtyPages: this.toNumber(cache.bytes_dirty, 0),
                dirtyPagesPercent: this.round(dirtyPercent, 2),
                hitRatio: this.round(hitRatio, 2),
                pagesRead: this.toNumber(cache.pages_read_into_cache, 0),
                pagesRequested: this.toNumber(cache.pages_requested_from_cache, 0),
                evictedPages: this.toNumber(cache.pages_evicted, 0),
                readTicketsAvailable: this.toNumber(wt.concurrentTransactions?.read?.available, 0),
                writeTicketsAvailable: this.toNumber(wt.concurrentTransactions?.write?.available, 0),
                readTicketsOut: this.toNumber(wt.concurrentTransactions?.read?.out, 0),
                writeTicketsOut: this.toNumber(wt.concurrentTransactions?.write?.out, 0),
            };
        } catch (error) {
            throw new Error(`Failed to get WiredTiger stats: ${error.message}`);
        }
    }

    /**
     * Get detailed collection statistics
     */
    async getCollectionStats() {
        try {
            const collections = await this.db.listCollections().toArray();
            const stats = [];

            for (const coll of collections) {
                try {
                    const collStats = await this.db.command({
                        collStats: coll.name,
                        verbose: true,
                    });

                    stats.push({
                        name: coll.name,
                        count: this.toNumber(collStats.count, 0),
                        size: this.toNumber(collStats.size, 0),
                        totalSize: this.toNumber(collStats.totalSize, 0),
                        totalIndexSize: this.toNumber(collStats.totalIndexSize, 0),
                        avgObjSize: this.toNumber(collStats.avgObjSize, 0),
                        capped: Boolean(collStats.capped),
                        maxSize: this.toNumber(collStats.max, null),
                        validationLevel: collStats.validationLevel || 'off',
                        numIndexes: this.toNumber(collStats.nindexes, 0),
                    });
                } catch (error) {
                    console.error(`Error getting stats for collection ${coll.name}:`, error.message);
                }
            }

            return stats;
        } catch (error) {
            throw new Error(`Failed to get collection stats: ${error.message}`);
        }
    }

    /**
     * Get active operations breakdown
     */
    async getActiveOperations() {
        try {
            const currentOp = await this.db.admin().command({ currentOp: 1 });
            const ops = currentOp.inprog || [];

            const breakdown = {
                total: ops.length,
                active: 0,
                waiting: 0,
                byType: {},
                longestRunning: null,
                longestDurationSec: 0,
                readOps: 0,
                writeOps: 0,
            };

            let longestOp = null;

            for (const op of ops) {
                if (op.active) {
                    breakdown.active++;
                } else if (op.waitingForLock) {
                    breakdown.waiting++;
                }

                // Track operation type
                const opType = op.operation || 'unknown';
                breakdown.byType[opType] = (breakdown.byType[opType] || 0) + 1;

                // Track read vs write
                if (['query', 'getmore'].includes(opType)) {
                    breakdown.readOps++;
                } else if (['insert', 'update', 'delete'].includes(opType)) {
                    breakdown.writeOps++;
                }

                // Track longest running
                const duration = this.toNumber(op.secs_running, 0);
                if (duration > breakdown.longestDurationSec) {
                    breakdown.longestDurationSec = duration;
                    longestOp = {
                        opid: this.toNumber(op.opid, 0),
                        operation: opType,
                        ns: op.ns,
                        durationSec: duration,
                        command: op.command ? JSON.stringify(op.command) : null,
                    };
                }
            }

            breakdown.longestRunning = longestOp;
            return breakdown;
        } catch (error) {
            throw new Error(`Failed to get active operations: ${error.message}`);
        }
    }

    /**
     * Get slow queries from system.profile collection
     */
    async getSlowQueries() {
        try {
            const profileCollection = this.db.collection('system.profile');

            // Get recent slow queries (millis > 100)
            const slowQueries = await profileCollection
                .find({ millis: { $gt: 100 } })
                .sort({ ts: -1 })
                .limit(100)
                .toArray();

            return slowQueries.map((query) => ({
                timestamp: query.ts,
                operation: query.op,
                namespace: query.ns,
                durationMs: this.toNumber(query.millis, 0),
                query: query.command ? JSON.stringify(query.command) : null,
                planSummary: query.planSummary || null,
                keysExamined: this.toNumber(query.keysExamined, 0),
                keysReturned: this.toNumber(query.keysReturned, 0),
                docsExamined: this.toNumber(query.docsExamined, 0),
                docsReturned: this.toNumber(query.docsReturned, 0),
                nreturned: this.toNumber(query.nreturned, 0),
                user: query.user || null,
            }));
        } catch (error) {
            // system.profile might not be enabled
            return [];
        }
    }

    /**
     * Get lock statistics and contention info
     */
    async getLockStats() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const locks = serverStatus.locks || {};
            const globalLock = serverStatus.globalLock || {};

            const lockStats = {
                globalLock: {
                    activeClients: this.toNumber(globalLock.activeClients?.total, 0),
                    readersWaiting: this.toNumber(globalLock.waiters?.readers, 0),
                    writersWaiting: this.toNumber(globalLock.waiters?.writers, 0),
                    totalTime: this.toNumber(globalLock.totalTimeAcquiredMicros, 0),
                },
                byNamespace: {},
            };

            // Parse per-namespace lock stats
            for (const [ns, lockData] of Object.entries(locks)) {
                if (lockData.acquireCount) {
                    lockStats.byNamespace[ns] = {
                        readLocks: this.toNumber(lockData.acquireCount?.R, 0),
                        writeLocks: this.toNumber(lockData.acquireCount?.W, 0),
                        intentReadLocks: this.toNumber(lockData.acquireCount?.r, 0),
                        intentWriteLocks: this.toNumber(lockData.acquireCount?.w, 0),
                        deadlocks:
                            this.toNumber(lockData.deadlockCount?.W, 0) + this.toNumber(lockData.deadlockCount?.R, 0),
                    };
                }
            }

            return lockStats;
        } catch (error) {
            throw new Error(`Failed to get lock stats: ${error.message}`);
        }
    }

    /**
     * Get latency statistics for reads, writes, and commands
     */
    async getLatencyStats() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const opLatencies = serverStatus.opLatencies || {};

            const extractLatencies = (latData) => {
                if (!latData) return { ops: 0, totalMicros: 0, avgMicros: 0 };
                const ops = this.toNumber(latData.ops, 0);
                const totalMicros = this.toNumber(latData.totalMicros, 0);
                return {
                    ops,
                    totalMicros,
                    avgMicros: ops > 0 ? this.round(totalMicros / ops, 2) : 0,
                };
            };

            return {
                read: extractLatencies(opLatencies.reads),
                write: extractLatencies(opLatencies.writes),
                command: extractLatencies(opLatencies.commands),
            };
        } catch (error) {
            throw new Error(`Failed to get latency stats: ${error.message}`);
        }
    }

    /**
     * Get network statistics
     */
    async getNetworkStats() {
        try {
            const serverStatus = await this.db.admin().serverStatus();
            const network = serverStatus.network || {};

            return {
                bytesIn: this.toNumber(network.bytesIn, 0),
                bytesOut: this.toNumber(network.bytesOut, 0),
                numRequests: this.toNumber(network.numRequests, 0),
            };
        } catch (error) {
            throw new Error(`Failed to get network stats: ${error.message}`);
        }
    }

    /**
     * Get sharding status if applicable
     */
    async getShardingStatus() {
        try {
            const adminDb = this.client.db('admin');
            const shardingStatus = await adminDb.admin().command({
                serverStatus: 1,
            });

            // Check if this is a sharded cluster
            try {
                const config = this.client.db('config');
                const shards = await config.collection('shards').countDocuments();
                const chunks = await config.collection('chunks').countDocuments();
                const balancer = await config.collection('settings').findOne({ _id: 'balancer' });

                return {
                    isSharded: true,
                    shardCount: this.toNumber(shards, 0),
                    chunkCount: this.toNumber(chunks, 0),
                    balancerEnabled: balancer?.stopped !== true,
                };
            } catch (e) {
                // Not a sharded cluster
                return {
                    isSharded: false,
                    shardCount: 0,
                    chunkCount: 0,
                    balancerEnabled: false,
                };
            }
        } catch (error) {
            return {
                isSharded: false,
                shardCount: 0,
                chunkCount: 0,
                balancerEnabled: false,
            };
        }
    }

    /**
     * Get comprehensive key metrics (60+ metrics organized by category)
     */
    async getKeyMetrics() {
        const metrics = [];

        try {
            const serverStatus = await this.db.admin().serverStatus();
            const dbStats = await this.db.stats();
            const currentOp = await this.db.admin().command({ currentOp: 1 });

            // OVERVIEW METRICS
            const connections = serverStatus.connections || {};
            const activeConn = this.toNumber(connections.current, 0);
            const totalConn = this.toNumber(connections.available, 0);

            metrics.push({
                id: 'active_connections',
                label: 'Active Connections',
                value: activeConn,
                unit: 'count',
                category: 'overview',
                severity: activeConn > 500 ? 'critical' : activeConn > 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 500 },
                description: 'Number of active client connections',
                dbSpecific: false,
            });

            metrics.push({
                id: 'available_connections',
                label: 'Available Connection Slots',
                value: totalConn - activeConn,
                unit: 'count',
                category: 'overview',
                severity: totalConn - activeConn < 50 ? 'critical' : totalConn - activeConn < 100 ? 'warning' : 'ok',
                thresholds: { warning: 100, critical: 50 },
                description: 'Available connection slots remaining',
                dbSpecific: false,
            });

            metrics.push({
                id: 'uptime_seconds',
                label: 'Uptime',
                value: this.toNumber(serverStatus.uptime, 0),
                unit: 'sec',
                category: 'overview',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Server uptime in seconds',
                dbSpecific: false,
            });

            metrics.push({
                id: 'server_version',
                label: 'Server Version',
                value: serverStatus.version || 'Unknown',
                unit: 'string',
                category: 'overview',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'MongoDB version',
                dbSpecific: false,
            });

            // PERFORMANCE METRICS
            const cacheRatio = this._calculateCacheHitRatio(serverStatus);
            metrics.push({
                id: 'cache_hit_ratio',
                label: 'Cache Hit Ratio',
                value: cacheRatio,
                unit: '%',
                category: 'performance',
                severity: cacheRatio >= 99 ? 'ok' : cacheRatio >= 90 ? 'warning' : 'critical',
                thresholds: { warning: 90, critical: 80 },
                description: 'Memory cache page hit ratio',
                dbSpecific: false,
            });

            const opcounters = serverStatus.opcounters || {};
            const uptime = serverStatus.uptime || 1;
            const opsPerSec =
                ((opcounters.insert || 0) +
                    (opcounters.query || 0) +
                    (opcounters.update || 0) +
                    (opcounters.delete || 0)) /
                uptime;

            metrics.push({
                id: 'operations_per_sec',
                label: 'Operations/Second',
                value: this.round(opsPerSec, 2),
                unit: 'ops/sec',
                category: 'performance',
                severity: opsPerSec > 50000 ? 'critical' : opsPerSec > 10000 ? 'warning' : 'ok',
                thresholds: { warning: 10000, critical: 50000 },
                description: 'Average operations per second',
                dbSpecific: false,
            });

            const activeOps = (currentOp.inprog || []).filter((op) => op.active === true).length;
            metrics.push({
                id: 'active_operations',
                label: 'Active Operations',
                value: activeOps,
                unit: 'count',
                category: 'performance',
                severity: activeOps > 100 ? 'critical' : activeOps > 50 ? 'warning' : 'ok',
                thresholds: { warning: 50, critical: 100 },
                description: 'Currently active database operations',
                dbSpecific: false,
            });

            const waitingOps = (currentOp.inprog || []).filter((op) => op.waitingForLock === true).length;
            metrics.push({
                id: 'operations_waiting',
                label: 'Operations Waiting for Lock',
                value: waitingOps,
                unit: 'count',
                category: 'performance',
                severity: waitingOps > 10 ? 'critical' : waitingOps > 0 ? 'warning' : 'ok',
                thresholds: { warning: 0, critical: 10 },
                description: 'Operations blocked waiting for locks',
                dbSpecific: false,
            });

            // Insert rate
            metrics.push({
                id: 'insert_operations',
                label: 'Insert Operations',
                value: this.toNumber(opcounters.insert, 0),
                unit: 'total',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total insert operations since startup',
                dbSpecific: false,
            });

            metrics.push({
                id: 'query_operations',
                label: 'Query Operations',
                value: this.toNumber(opcounters.query, 0),
                unit: 'total',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total query operations since startup',
                dbSpecific: false,
            });

            metrics.push({
                id: 'update_operations',
                label: 'Update Operations',
                value: this.toNumber(opcounters.update, 0),
                unit: 'total',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total update operations since startup',
                dbSpecific: false,
            });

            metrics.push({
                id: 'delete_operations',
                label: 'Delete Operations',
                value: this.toNumber(opcounters.delete, 0),
                unit: 'total',
                category: 'performance',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total delete operations since startup',
                dbSpecific: false,
            });

            // STORAGE METRICS
            const dataSize = this.toNumber(dbStats.dataSize, 0);
            const indexSize = this.toNumber(dbStats.indexSize, 0);
            const totalSize = dataSize + indexSize;

            metrics.push({
                id: 'data_size_bytes',
                label: 'Data Size',
                value: dataSize,
                unit: 'bytes',
                category: 'storage',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total size of data in database',
                dbSpecific: false,
            });

            metrics.push({
                id: 'index_size_bytes',
                label: 'Index Size',
                value: indexSize,
                unit: 'bytes',
                category: 'storage',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total size of indexes',
                dbSpecific: false,
            });

            metrics.push({
                id: 'total_db_size_bytes',
                label: 'Total Database Size',
                value: totalSize,
                unit: 'bytes',
                category: 'storage',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total database size (data + indexes)',
                dbSpecific: false,
            });

            // WiredTiger stats
            const wt = serverStatus.wiredTiger || {};
            const cache = wt.cache || {};
            const wtCacheMB = this.toNumber(cache.maximum_bytes_configured, 0) / (1024 * 1024);
            const wtCacheUsedMB = this.toNumber(cache.bytes_allocated, 0) / (1024 * 1024);

            metrics.push({
                id: 'wt_cache_size_mb',
                label: 'WiredTiger Cache Size',
                value: this.round(wtCacheMB, 2),
                unit: 'MB',
                category: 'storage',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'WiredTiger cache maximum size',
                dbSpecific: true,
            });

            metrics.push({
                id: 'wt_cache_used_mb',
                label: 'WiredTiger Cache Used',
                value: this.round(wtCacheUsedMB, 2),
                unit: 'MB',
                category: 'storage',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'WiredTiger cache currently used',
                dbSpecific: true,
            });

            const wtCachePercent = wtCacheMB > 0 ? (wtCacheUsedMB / wtCacheMB) * 100 : 0;
            metrics.push({
                id: 'wt_cache_used_percent',
                label: 'WiredTiger Cache Used %',
                value: this.round(wtCachePercent, 2),
                unit: '%',
                category: 'storage',
                severity: wtCachePercent > 90 ? 'critical' : wtCachePercent > 75 ? 'warning' : 'ok',
                thresholds: { warning: 75, critical: 90 },
                description: 'WiredTiger cache utilization percentage',
                dbSpecific: true,
            });

            const dirtyBytes = this.toNumber(cache.bytes_dirty, 0);
            const dirtyPercent = totalSize > 0 ? (dirtyBytes / totalSize) * 100 : 0;
            metrics.push({
                id: 'wt_dirty_pages_percent',
                label: 'WiredTiger Dirty Pages %',
                value: this.round(dirtyPercent, 2),
                unit: '%',
                category: 'storage',
                severity: dirtyPercent > 50 ? 'warning' : 'ok',
                thresholds: { warning: 50, critical: 80 },
                description: 'Percentage of dirty pages in cache',
                dbSpecific: true,
            });

            // REPLICATION METRICS
            try {
                const replicaStatus = await this.db.admin().command({ replSetGetStatus: 1 });
                if (replicaStatus && replicaStatus.members) {
                    const members = replicaStatus.members;
                    const primaryMember = members.find((m) => m.state === 1);
                    const secondaryMembers = members.filter((m) => m.state === 2);

                    metrics.push({
                        id: 'is_replica_set',
                        label: 'Replica Set Active',
                        value: primaryMember ? 1 : 0,
                        unit: 'bool',
                        category: 'replication',
                        severity: primaryMember ? 'ok' : 'critical',
                        thresholds: { warning: 0, critical: 0 },
                        description: 'Whether this is part of an active replica set',
                        dbSpecific: true,
                    });

                    metrics.push({
                        id: 'replica_count',
                        label: 'Replica Count',
                        value: secondaryMembers.length,
                        unit: 'count',
                        category: 'replication',
                        severity: secondaryMembers.length > 0 ? 'ok' : 'warning',
                        thresholds: { warning: 0, critical: 0 },
                        description: 'Number of secondary replicas',
                        dbSpecific: true,
                    });

                    let maxLagSeconds = 0;
                    if (primaryMember && secondaryMembers.length > 0) {
                        const primaryOptime = primaryMember.optime?.ts;
                        for (const secondary of secondaryMembers) {
                            const secondaryOptime = secondary.optime?.ts;
                            if (primaryOptime && secondaryOptime) {
                                const lagSeconds = (primaryOptime.getTime() - secondaryOptime.getTime()) / 1000;
                                maxLagSeconds = Math.max(maxLagSeconds, lagSeconds);
                            }
                        }
                    }

                    metrics.push({
                        id: 'max_replication_lag_sec',
                        label: 'Max Replication Lag',
                        value: this.round(maxLagSeconds, 2),
                        unit: 'sec',
                        category: 'replication',
                        severity: maxLagSeconds > 60 ? 'critical' : maxLagSeconds > 10 ? 'warning' : 'ok',
                        thresholds: { warning: 10, critical: 60 },
                        description: 'Maximum replication lag across replicas',
                        dbSpecific: true,
                    });
                }
            } catch (e) {
                // Not a replica set
            }

            // CONNECTION METRICS
            metrics.push({
                id: 'current_connections',
                label: 'Current Connections',
                value: activeConn,
                unit: 'count',
                category: 'connections',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Currently active connections',
                dbSpecific: false,
            });

            metrics.push({
                id: 'connection_pool_size',
                label: 'Connection Pool Size',
                value: totalConn,
                unit: 'count',
                category: 'connections',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Total available connection slots',
                dbSpecific: false,
            });

            // Memory metrics
            const mem = serverStatus.mem || {};
            metrics.push({
                id: 'memory_resident_mb',
                label: 'Memory Resident',
                value: this.toNumber(mem.resident, 0),
                unit: 'MB',
                category: 'connections',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Resident memory used',
                dbSpecific: false,
            });

            metrics.push({
                id: 'memory_virtual_mb',
                label: 'Memory Virtual',
                value: this.toNumber(mem.virtual, 0),
                unit: 'MB',
                category: 'connections',
                severity: 'ok',
                thresholds: { warning: 0, critical: 0 },
                description: 'Virtual memory allocated',
                dbSpecific: false,
            });
        } catch (error) {
            console.error('Error getting MongoDB metrics:', error.message);
        }

        return metrics;
    }

    getCapabilities() {
        return {
            replication: true,
            vacuum: false,
            indexes: true,
            locks: true,
            queryPlan: false,
            wal: false,
            schemas: false,
            storedProcedures: false,
            partitioning: false,
            sharding: true,
            monitoring: {
                serverStatus: true,
                wiredTigerStats: true,
                replicationStatus: true,
                collectionStats: true,
                indexStats: true,
                activeOperations: true,
                slowQueries: true,
                lockStats: true,
                latencyStats: true,
                networkStats: true,
                shardingStatus: true,
            },
        };
    }

    // Helper methods

    _calculateCacheHitRatio(serverStatus) {
        const wt = serverStatus.wiredTiger;
        if (!wt) return 0;

        const cache = wt.cache;
        if (!cache) return 0;

        const pagesRead = this.toNumber(cache.pages_read_into_cache, 1);
        const requestedPages = this.toNumber(cache.pages_requested_from_cache, 1);

        if (requestedPages === 0) return 0;

        const hitRatio = ((requestedPages - pagesRead) / requestedPages) * 100;
        return this.round(Math.max(0, hitRatio), 2);
    }
}

export default MongoDBAdapter;
