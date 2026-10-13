// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
import { Router } from 'express';

export default function mysqlRoutes(pool, authenticate, getPool, CONNECTIONS) {
    const router = Router();

    // Helper to get MySQL pool for request (scoped to authenticated user)
    async function reqMysqlPool(req) {
        return getPool(req.query.connectionId || null, req.user?.id);
    }

    // GET /api/mysql/overview
    // Returns overview metrics: connections, version, uptime, queries/sec, slow queries, etc.
    router.get('/api/mysql/overview', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);

            // Get version
            const [versionRows] = await mysqlPool.query('SELECT @@version as version');
            const version = versionRows[0]?.version || 'unknown';

            // Get status variables
            const [statusRows] = await mysqlPool.query('SHOW GLOBAL STATUS');
            const statusMap = {};
            statusRows.forEach(row => {
                statusMap[row.Variable_name] = row.Value;
            });

            // Get variables
            const [variablesRows] = await mysqlPool.query('SHOW VARIABLES LIKE "max_connections"');
            const maxConnections = parseInt(variablesRows[0]?.Value || 0);

            // Get database size
            let databaseSize = 0;
            try {
                const [sizeRows] = await mysqlPool.query(
                    'SELECT SUM(data_length + index_length) as total_size FROM information_schema.tables'
                );
                databaseSize = parseInt(sizeRows[0]?.total_size || 0);
            } catch (e) {
                // Ignore errors from information_schema query
            }

            // Calculate metrics
            const threadsConnected = parseInt(statusMap.Threads_connected || 0);
            const threadsRunning = parseInt(statusMap.Threads_running || 0);
            const uptime = parseInt(statusMap.Uptime || 1);
            const questions = parseInt(statusMap.Questions || 0);
            const slowQueries = parseInt(statusMap.Slow_queries || 0);
            const innodbReadRequests = parseInt(statusMap.Innodb_buffer_pool_read_requests || 1);
            const innodbReads = parseInt(statusMap.Innodb_buffer_pool_reads || 0);
            const threadsCreated = parseInt(statusMap.Threads_created || 1);
            const connections = parseInt(statusMap.Connections || 1);

            const bufferPoolHitRatio = ((innodbReadRequests - innodbReads) / innodbReadRequests * 100).toFixed(2);
            const threadCacheHitRatio = ((1 - (threadsCreated / connections)) * 100).toFixed(2);
            const queriesPerSec = (questions / uptime).toFixed(2);

            // Try to get replication info
            let replication = null;
            try {
                const [replRows] = await mysqlPool.query('SHOW SLAVE STATUS');
                if (replRows.length > 0) {
                    replication = {
                        slave_io_running: replRows[0].Slave_IO_Running,
                        slave_sql_running: replRows[0].Slave_SQL_Running,
                        seconds_behind_master: replRows[0].Seconds_Behind_Master,
                        master_host: replRows[0].Master_Host
                    };
                }
            } catch (e) {
                // Replication might not be configured
            }

            res.json({
                version,
                uptime,
                connections: {
                    current: threadsConnected,
                    max: maxConnections,
                    active: threadsRunning
                },
                queries_per_sec: queriesPerSec,
                slow_queries: slowQueries,
                buffer_pool_hit_ratio: bufferPoolHitRatio,
                thread_cache_hit_ratio: threadCacheHitRatio,
                database_size: databaseSize,
                replication
            });
        } catch (error) {
            console.error('Error fetching MySQL overview:', error);
            res.json({
                version: 'unknown',
                uptime: 0,
                connections: { current: 0, max: 0, active: 0 },
                queries_per_sec: 0,
                slow_queries: 0,
                buffer_pool_hit_ratio: 0,
                thread_cache_hit_ratio: 0,
                database_size: 0,
                replication: null
            });
        }
    });

    // GET /api/mysql/performance
    // Returns performance metrics: slow queries, thread stats, InnoDB stats
    router.get('/api/mysql/performance', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);

            let slowQueries = [];
            let threadStats = {};
            let innodbStats = {};

            // Try to get slow queries from performance_schema
            try {
                const [slowRows] = await mysqlPool.query(
                    'SELECT DIGEST_TEXT, COUNT_STAR, SUM_TIMER_WAIT, AVG_TIMER_WAIT, SUM_LOCK_TIME FROM performance_schema.events_statements_summary_by_digest ORDER BY SUM_TIMER_WAIT DESC LIMIT 20'
                );
                slowQueries = slowRows.map(row => ({
                    query: row.DIGEST_TEXT || 'N/A',
                    count: row.COUNT_STAR,
                    total_time: row.SUM_TIMER_WAIT,
                    avg_time: row.AVG_TIMER_WAIT,
                    lock_time: row.SUM_LOCK_TIME
                }));
            } catch (e) {
                // Performance schema might not be enabled
            }

            // Get thread stats from SHOW STATUS
            try {
                const [statusRows] = await mysqlPool.query('SHOW GLOBAL STATUS LIKE "Threads%"');
                statusRows.forEach(row => {
                    threadStats[row.Variable_name] = row.Value;
                });
            } catch (e) {
                // Ignore
            }

            // Get InnoDB stats
            try {
                const [statusRows] = await mysqlPool.query(
                    'SHOW GLOBAL STATUS LIKE "Innodb%"'
                );
                const statusMap = {};
                statusRows.forEach(row => {
                    statusMap[row.Variable_name] = row.Value;
                });

                const [varRows] = await mysqlPool.query(
                    'SHOW VARIABLES LIKE "innodb_buffer_pool_size"'
                );
                const bufferPoolSize = parseInt(varRows[0]?.Value || 0);

                innodbStats = {
                    buffer_pool_size: bufferPoolSize,
                    buffer_pool_pages_free: statusMap.Innodb_buffer_pool_pages_free,
                    buffer_pool_pages_data: statusMap.Innodb_buffer_pool_pages_data,
                    buffer_pool_pages_dirty: statusMap.Innodb_buffer_pool_pages_dirty,
                    buffer_pool_pages_total: statusMap.Innodb_buffer_pool_pages_total,
                    reads_per_sec: statusMap.Innodb_data_reads,
                    writes_per_sec: statusMap.Innodb_data_writes
                };
            } catch (e) {
                // Ignore
            }

            res.json({
                slow_queries: slowQueries,
                thread_stats: threadStats,
                innodb_stats: innodbStats
            });
        } catch (error) {
            console.error('Error fetching MySQL performance:', error);
            res.json({
                slow_queries: [],
                thread_stats: {},
                innodb_stats: {}
            });
        }
    });

    // GET /api/mysql/active-queries
    // Returns list of active queries from SHOW PROCESSLIST
    router.get('/api/mysql/active-queries', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            const [rows] = await mysqlPool.query('SHOW PROCESSLIST');

            // Filter out Sleep processes
            const activeQueries = rows
                .filter(row => row.Command !== 'Sleep')
                .map(row => ({
                    id: row.ID,
                    user: row.User,
                    host: row.Host,
                    db: row.db || null,
                    command: row.Command,
                    time: row.Time,
                    state: row.State,
                    info: row.Info || ''
                }));

            res.json(activeQueries);
        } catch (error) {
            console.error('Error fetching active queries:', error);
            res.json([]);
        }
    });

    // GET /api/mysql/variables
    // Returns MySQL global variables
    router.get('/api/mysql/variables', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            const [rows] = await mysqlPool.query('SHOW GLOBAL VARIABLES');

            // Filter to key variables
            const keyVars = [
                'max_connections',
                'innodb_buffer_pool_size',
                'query_cache_size',
                'max_allowed_packet',
                'tmp_table_size',
                'max_heap_table_size',
                'long_query_time',
                'slow_query_log',
                'log_bin',
                'binlog_format',
                'character_set_server',
                'collation_server',
                'default_storage_engine',
                'innodb_log_file_size',
                'innodb_flush_log_at_trx_commit',
                'sync_binlog'
            ];

            const variables = {};
            rows.forEach(row => {
                if (keyVars.includes(row.Variable_name) || req.query.all === 'true') {
                    variables[row.Variable_name] = row.Value;
                }
            });

            res.json(variables);
        } catch (error) {
            console.error('Error fetching MySQL variables:', error);
            res.json({});
        }
    });

    // GET /api/mysql/databases
    // Returns list of databases with size information
    router.get('/api/mysql/databases', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            const [rows] = await mysqlPool.query(
                `SELECT
                    table_schema as database_name,
                    SUM(data_length + index_length) as size,
                    COUNT(*) as table_count
                FROM information_schema.tables
                GROUP BY table_schema
                ORDER BY size DESC`
            );

            const databases = rows.map(row => ({
                name: row.database_name,
                size: row.size || 0,
                table_count: row.table_count || 0
            }));

            res.json(databases);
        } catch (error) {
            console.error('Error fetching databases:', error);
            res.json([]);
        }
    });

    // GET /api/mysql/tables
    // Returns tables in specified database with size and row count
    router.get('/api/mysql/tables', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            const database = req.query.database;

            if (!database) {
                return res.json([]);
            }

            const [rows] = await mysqlPool.query(
                `SELECT
                    table_name,
                    table_schema,
                    engine,
                    table_rows,
                    data_length,
                    index_length,
                    data_free,
                    (data_length + index_length) as total_size
                FROM information_schema.tables
                WHERE table_schema = ?
                ORDER BY total_size DESC`,
                [database]
            );

            const tables = rows.map(row => ({
                name: row.table_name,
                engine: row.engine,
                row_count: row.table_rows || 0,
                data_size: row.data_length || 0,
                index_size: row.index_length || 0,
                total_size: row.total_size || 0,
                free_size: row.data_free || 0
            }));

            res.json(tables);
        } catch (error) {
            console.error('Error fetching tables:', error);
            res.json([]);
        }
    });

    // GET /api/mysql/innodb-status
    // Returns parsed SHOW ENGINE INNODB STATUS output
    router.get('/api/mysql/innodb-status', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            const [rows] = await mysqlPool.query('SHOW ENGINE INNODB STATUS');

            let status = {
                raw: '',
                transactions: {},
                buffer_pool: {},
                log: {}
            };

            if (rows.length > 0) {
                status.raw = rows[0].Status || '';

                // Parse key sections
                const statusText = status.raw;

                // Extract transaction info
                const txMatch = statusText.match(/(\d+) active transaction/i);
                if (txMatch) {
                    status.transactions.active = parseInt(txMatch[1]);
                }

                // Extract lock info
                const lockMatch = statusText.match(/(\d+) lock struct/i);
                if (lockMatch) {
                    status.transactions.locks = parseInt(lockMatch[1]);
                }

                // Extract log sequence number
                const lsnMatch = statusText.match(/Log sequence number (\d+)/i);
                if (lsnMatch) {
                    status.log.sequence_number = lsnMatch[1];
                }

                // Extract checkpoint info
                const cpMatch = statusText.match(/Last checkpoint at (\d+)/i);
                if (cpMatch) {
                    status.log.last_checkpoint = cpMatch[1];
                }
            }

            res.json(status);
        } catch (error) {
            console.error('Error fetching InnoDB status:', error);
            res.json({
                raw: '',
                transactions: {},
                buffer_pool: {},
                log: {}
            });
        }
    });

    // GET /api/mysql/replication
    // Returns replication status from SHOW SLAVE STATUS or SHOW REPLICA STATUS
    router.get('/api/mysql/replication', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);

            let replicationStatus = {
                configured: false,
                status: null
            };

            // Try SHOW SLAVE STATUS first (older MySQL)
            try {
                const [rows] = await mysqlPool.query('SHOW SLAVE STATUS');
                if (rows.length > 0) {
                    const row = rows[0];
                    replicationStatus.configured = true;
                    replicationStatus.status = {
                        master_host: row.Master_Host,
                        master_user: row.Master_User,
                        master_port: row.Master_Port,
                        slave_io_running: row.Slave_IO_Running,
                        slave_sql_running: row.Slave_SQL_Running,
                        seconds_behind_master: row.Seconds_Behind_Master,
                        last_errno: row.Last_Errno,
                        last_error: row.Last_Error,
                        relay_log_file: row.Relay_Log_File,
                        relay_log_pos: row.Relay_Log_Pos,
                        master_log_file: row.Master_Log_File,
                        read_master_log_pos: row.Read_Master_Log_Pos,
                        exec_master_log_pos: row.Exec_Master_Log_Pos,
                        retrieved_gtid_set: row.Retrieved_Gtid_Set || null,
                        executed_gtid_set: row.Executed_Gtid_Set || null
                    };
                }
            } catch (e) {
                // Try SHOW REPLICA STATUS (MySQL 8.0+)
                try {
                    const [rows] = await mysqlPool.query('SHOW REPLICA STATUS');
                    if (rows.length > 0) {
                        const row = rows[0];
                        replicationStatus.configured = true;
                        replicationStatus.status = {
                            source_host: row.Source_Host || row.Master_Host,
                            source_user: row.Source_User || row.Master_User,
                            source_port: row.Source_Port || row.Master_Port,
                            replica_io_running: row.Replica_IO_Running || row.Slave_IO_Running,
                            replica_sql_running: row.Replica_SQL_Running || row.Slave_SQL_Running,
                            seconds_behind_source: row.Seconds_Behind_Source || row.Seconds_Behind_Master,
                            last_errno: row.Last_Errno,
                            last_error: row.Last_Error,
                            relay_log_file: row.Relay_Log_File,
                            relay_log_pos: row.Relay_Log_Pos,
                            source_log_file: row.Source_Log_File || row.Master_Log_File,
                            read_source_log_pos: row.Read_Source_Log_Pos || row.Read_Master_Log_Pos,
                            exec_source_log_pos: row.Exec_Source_Log_Pos || row.Exec_Master_Log_Pos,
                            retrieved_gtid_set: row.Retrieved_Gtid_Set || null,
                            executed_gtid_set: row.Executed_Gtid_Set || null
                        };
                    }
                } catch (e2) {
                    // Replication not configured
                }
            }

            res.json(replicationStatus);
        } catch (error) {
            console.error('Error fetching replication status:', error);
            res.json({
                configured: false,
                status: null
            });
        }
    });

    // GET /api/mysql/users
    // Returns MySQL user list with privileges
    router.get('/api/mysql/users', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            const [rows] = await mysqlPool.query(
                'SELECT User, Host, Super_priv, Grant_priv, Create_priv, Drop_priv FROM mysql.user ORDER BY User, Host'
            );

            const users = rows.map(row => ({
                user: row.User,
                host: row.Host,
                super_priv: row.Super_priv === 'Y',
                grant_priv: row.Grant_priv === 'Y',
                create_priv: row.Create_priv === 'Y',
                drop_priv: row.Drop_priv === 'Y'
            }));

            res.json(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            res.json([]);
        }
    });

    // GET /api/mysql/locks
    // Returns lock information from performance_schema or information_schema
    router.get('/api/mysql/locks', authenticate, async (req, res) => {
        try {
            const mysqlPool = await reqMysqlPool(req);
            let locks = [];

            // Try performance_schema first
            try {
                const [rows] = await mysqlPool.query(
                    `SELECT
                        OBJECT_SCHEMA,
                        OBJECT_NAME,
                        LOCK_TYPE,
                        LOCK_STATUS,
                        THREAD_ID,
                        EVENT_ID
                    FROM performance_schema.data_locks
                    LIMIT 100`
                );
                locks = rows.map(row => ({
                    schema: row.OBJECT_SCHEMA,
                    table: row.OBJECT_NAME,
                    type: row.LOCK_TYPE,
                    status: row.LOCK_STATUS,
                    thread_id: row.THREAD_ID,
                    event_id: row.EVENT_ID
                }));
            } catch (e) {
                // Try information_schema.innodb_locks (older MySQL)
                try {
                    const [rows] = await mysqlPool.query(
                        `SELECT
                            lock_id,
                            lock_type,
                            lock_table,
                            lock_index,
                            lock_space,
                            lock_page,
                            lock_rec,
                            lock_data
                        FROM information_schema.innodb_locks
                        LIMIT 100`
                    );
                    locks = rows.map(row => ({
                        lock_id: row.lock_id,
                        type: row.lock_type,
                        table: row.lock_table,
                        index: row.lock_index,
                        data: row.lock_data
                    }));
                } catch (e2) {
                    // Locks info not available
                }
            }

            res.json(locks);
        } catch (error) {
            console.error('Error fetching locks:', error);
            res.json([]);
        }
    });

    return router;
}
