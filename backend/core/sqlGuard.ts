// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// Validation for user-supplied SQL (EXPLAIN input and the SQL console).
// Extracted from server.ts.

import { log } from '../services/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// SQL INJECTION GUARD
// ─────────────────────────────────────────────────────────────────────────────
const DANGEROUS_SQL =
    /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE|ALTER|GRANT|REVOKE|COPY|EXECUTE|DO\b|CALL|NOTIFY|LISTEN|LOAD|LOCK\s+TABLE|CHECKPOINT|SECURITY\s+LABEL|SET\s+ROLE|RESET\s+ALL)\b/i;

// Additional bypass patterns to detect SQL injection attempts.
//
// Note: the previous /\$\d+/ rule was removed — $1/$2/$N is the standard
// Postgres bind-placeholder syntax, and legitimate users will paste
// parameterized queries (EXACTLY what this tool is supposed to analyze).
// Bind placeholders cannot create an injection by themselves: in EXPLAIN
// they are bound to literal NULL, so they are safe to allow.
const INJECTION_BYPASS_PATTERNS = [
    /\bUNION\b/i, // UNION-based injection
    /\b(AND|OR)\b.*=.*1\b/i, // Tautology injection
    /['"`];?\s*-{2}|['"`];?\s*\/\*/, // Comment-based injection
    /\bEXISTS\b.*\(/i, // EXISTS-based injection
    /\bCASE\b.*\bWHEN\b/i, // CASE-based injection
];

function sanitizeSqlForValidation(sql) {
    // Remove SQL comments
    let cleaned = sql
        .replace(/--[^\n]*/g, ' ') // Single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ' ') // Multi-line comments
        .replace(/#[^\n]*/g, ' '); // MySQL-style comments

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
}

export function validateExplainQuery(sql) {
    if (!sql || typeof sql !== 'string') return 'Query must be a non-empty string';
    if (sql.length > 8_000) return 'Query too long (max 8,000 characters)';

    const stripped = sanitizeSqlForValidation(sql);

    if (!stripped) return 'Query is empty';
    if (/;/.test(stripped.replace(/;$/, ''))) return 'Multiple SQL statements are not allowed';

    // Check for dangerous operations
    if (DANGEROUS_SQL.test(stripped)) {
        return 'Query contains disallowed SQL operations (only SELECT is allowed here)';
    }

    // Check for injection bypass patterns
    for (const pattern of INJECTION_BYPASS_PATTERNS) {
        if (pattern.test(stripped)) {
            log('WARN', 'Suspicious SQL pattern detected in EXPLAIN query', {
                pattern: pattern.toString(),
                queryLength: sql.length,
            });
            return 'Query contains suspicious patterns that may indicate SQL injection attempts';
        }
    }

    return null;
}

// Blocked for ALL users - these are critical security risks
const CRITICAL_BLOCKED =
    /\b(COPY\s+\S+\s+TO\s+PROGRAM|DROP\s+(DATABASE|SCHEMA)|ALTER\s+SYSTEM|CREATE\s+EXTENSION|pg_execute_server_program|pg_read_file|pg_write_file|pg_read_binary_file|pg_execute)\b/i;

// Additional restrictions for non-super_admin users
const CONSOLE_BLOCKED =
    /\b(DROP\s+(DATABASE|SCHEMA|ROLE|TABLESPACE)|CREATE\s+(DATABASE|ROLE|USER)|ALTER\s+(SYSTEM|ROLE\s+\S+\s+SUPERUSER)|COPY\s+\S+\s+(FROM|TO)\s+(STDIN|STDOUT|'|E')|LOAD\s+'|pg_read_file|pg_write_file|pg_read_binary_file)\b/i;

export function validateConsoleQuery(sql, role) {
    if (!sql || typeof sql !== 'string') return 'Query must be a non-empty string';
    if (sql.length > 50_000) return 'Query too long (max 50,000 characters)';

    const stripped = sanitizeSqlForValidation(sql);
    // Also check with all whitespace collapsed to catch obfuscation attempts like DROP/***/DATABASE
    const collapsed = stripped.replace(/\s+/g, ' ');

    // Check critical blocks for ALL users (including super_admin)
    if (CRITICAL_BLOCKED.test(stripped) || CRITICAL_BLOCKED.test(collapsed)) {
        log('ERROR', 'Critical SQL blocked for user', { role, queryLength: sql.length });
        return 'This statement is blocked - it poses a critical security risk and cannot be executed.';
    }

    // Check for injection bypass patterns
    for (const pattern of INJECTION_BYPASS_PATTERNS) {
        if (pattern.test(stripped)) {
            log('WARN', 'Suspicious SQL pattern detected in console query', {
                role,
                pattern: pattern.toString(),
                queryLength: sql.length,
            });
        }
    }

    // Additional role-based restrictions for non-super_admin users
    if (role !== 'super_admin' && CONSOLE_BLOCKED.test(stripped)) {
        return 'This statement is blocked for your role. Contact a super_admin.';
    }

    return null;
}
