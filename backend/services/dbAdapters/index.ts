// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)
/**
 * Database Adapter Factory
 *
 * This factory provides:
 * 1. Connection string parsing to detect database type
 * 2. Adapter instantiation for the appropriate database type
 * 3. Registry of supported databases
 *
 * The adapter pattern allows FATHOM to support multiple databases while maintaining
 * a unified monitoring interface across the frontend and backend.
 */

import PostgresAdapter from './PostgresAdapter.js';
import MySQLAdapter from './MySQLAdapter.js';
import MongoDBAdapter from './MongoDBAdapter.js';
import RedisAdapter from './RedisAdapter.js';
import ElasticsearchAdapter from './ElasticsearchAdapter.js';
import MSSQLAdapter from './MSSQLAdapter.js';
import OracleAdapter from './OracleAdapter.js';
import SnowflakeAdapter from './SnowflakeAdapter.js';
import BigQueryAdapter from './BigQueryAdapter.js';
import RedshiftAdapter from './RedshiftAdapter.js';
import CassandraAdapter from './CassandraAdapter.js';
import DynamoDBAdapter from './DynamoDBAdapter.js';

/** Supported database types */
export const SUPPORTED_DB_TYPES = [
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'elasticsearch',
    'mssql',
    'oracle',
    'snowflake',
    'bigquery',
    'redshift',
    'cassandra',
    'dynamodb',
];

/**
 * Detect the database type from a connection string
 *
 * Supports:
 * - postgres://user:pass@host:port/db
 * - postgresql://user:pass@host:port/db
 * - mysql://user:pass@host:port/db
 * - mongodb://user:pass@host:port/db
 * - mongodb+srv://user:pass@host/db (MongoDB with SRV records)
 *
 * @param {string} connectionString - Connection string to parse
 * @returns {string} Detected database type (lowercase), or null if unrecognized
 */
export function detectDbType(connectionString) {
    if (!connectionString || typeof connectionString !== 'string') {
        return null;
    }

    const lower = connectionString.toLowerCase();

    if (lower.startsWith('postgres://') || lower.startsWith('postgresql://')) {
        return 'postgresql';
    }
    if (lower.startsWith('mysql://')) {
        return 'mysql';
    }
    if (lower.startsWith('mongodb://') || lower.startsWith('mongodb+srv://')) {
        return 'mongodb';
    }
    if (lower.startsWith('redis://') || lower.startsWith('rediss://')) {
        return 'redis';
    }
    // Microsoft SQL Server: official `mssql://` scheme + `sqlserver://` JDBC-style.
    if (lower.startsWith('mssql://') || lower.startsWith('sqlserver://')) {
        return 'mssql';
    }
    // Oracle: `oracle://` (our convention) + EasyConnect `oracle+thin://`.
    if (lower.startsWith('oracle://') || lower.startsWith('oracle+thin://')) {
        return 'oracle';
    }
    // Snowflake JDBC-style: `snowflake://account.region.snowflakecomputing.com/db`.
    if (lower.startsWith('snowflake://')) {
        return 'snowflake';
    }
    // BigQuery: `bigquery://project-id/dataset` (Fathom convention).
    if (lower.startsWith('bigquery://')) {
        return 'bigquery';
    }
    // Redshift speaks the Postgres wire protocol but we route it through a
    // distinct adapter so MVCC/bloat queries don't run against it.
    if (lower.startsWith('redshift://')) {
        return 'redshift';
    }
    // Cassandra / Scylla.
    if (lower.startsWith('cassandra://') || lower.startsWith('scylla://')) {
        return 'cassandra';
    }
    // DynamoDB: no native conn string — Fathom convention `dynamodb://region/table`.
    if (lower.startsWith('dynamodb://')) {
        return 'dynamodb';
    }
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
        // Elasticsearch/OpenSearch connection strings are plain HTTP(S) URLs.
        // We only claim this type if the caller explicitly asked for it — the
        // bare URL shape is ambiguous, so callers should prefer getAdapter('elasticsearch', ...).
        return null;
    }

    return null;
}

/**
 * Get an adapter instance for the specified database type
 *
 * @param {string} dbType - Database type ('postgresql', 'mysql', 'mongodb')
 * @param {Object} config - Database connection configuration
 * @returns {BaseAdapter} Adapter instance
 * @throws {Error} If database type is not supported
 */
export function getAdapter(dbType, config = {}) {
    const normalized = String(dbType).toLowerCase().trim();

    switch (normalized) {
        case 'postgresql':
        case 'postgres':
            return new PostgresAdapter(config);

        case 'mysql':
            return new MySQLAdapter(config);

        case 'mongodb':
        case 'mongo':
            return new MongoDBAdapter(config);

        case 'redis':
            return new RedisAdapter(config);

        case 'elasticsearch':
        case 'opensearch':
        case 'elastic':
            return new ElasticsearchAdapter(config);

        case 'mssql':
        case 'sqlserver':
        case 'sql-server':
            return new MSSQLAdapter(config);

        case 'oracle':
        case 'oracledb':
            return new OracleAdapter(config);

        case 'snowflake':
            return new SnowflakeAdapter(config);

        case 'bigquery':
        case 'gbq':
            return new BigQueryAdapter(config);

        case 'redshift':
            return new RedshiftAdapter(config);

        case 'cassandra':
        case 'scylla':
            return new CassandraAdapter(config);

        case 'dynamodb':
        case 'dynamo':
            return new DynamoDBAdapter(config);

        default:
            throw new Error(
                `Unsupported database type: "${dbType}". Supported types: ${SUPPORTED_DB_TYPES.join(', ')}`
            );
    }
}

/**
 * Create an adapter by detecting the type from a connection string
 *
 * @param {string} connectionString - Connection string to parse
 * @param {Object} config - Additional configuration
 * @returns {BaseAdapter} Adapter instance, or null if type cannot be detected
 */
export function getAdapterFromString(connectionString, config = {}) {
    const dbType = detectDbType(connectionString);
    if (!dbType) {
        throw new Error(
            `Cannot detect database type from connection string. ` +
            `Supported prefixes: postgres://, mysql://, mongodb://, redis://, mssql://, ` +
            `oracle://, snowflake://, bigquery://, redshift://, cassandra://, dynamodb://. ` +
            `For Elasticsearch, use getAdapter('elasticsearch', config) directly.`
        );
    }
    return getAdapter(dbType, config);
}

export default {
    getAdapter,
    getAdapterFromString,
    detectDbType,
    SUPPORTED_DB_TYPES,
};
