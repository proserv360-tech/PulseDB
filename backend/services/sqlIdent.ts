/**
 * services/sqlIdent.ts
 * ────────────────────
 * The single source of truth for quoting Postgres identifiers and string
 * literals when building SQL that cannot be fully parameterized (DDL, index
 * names, generated migration text).
 *
 * WHY THIS EXISTS
 * ---------------
 * `quoteIdent()` previously existed in BOTH `indexAdvisor.ts` and
 * `schemaDiffService.ts` as separate copies. Two implementations of the same
 * security primitive is exactly how one of them ends up subtly wrong. This
 * module collapses them to one tested definition; both callers now import it.
 *
 * These are a last resort. Prefer parameterized queries ($1, $2, …) for
 * VALUES. Identifiers can't be parameterized, so they must be quoted — never
 * interpolated raw.
 */

/**
 * Quote a SQL identifier (table, column, index, type name) safely by wrapping
 * it in double quotes and doubling any embedded double quotes. An empty or
 * nullish name yields `""` (an empty quoted identifier) rather than throwing,
 * preserving the behaviour both prior copies had.
 */
export function quoteIdent(name: string | null | undefined): string {
    if (!name) return '""';
    return `"${String(name).replace(/"/g, '""')}"`;
}

/**
 * Quote a SQL string literal safely by wrapping it in single quotes and
 * doubling any embedded single quotes. `null`/`undefined` become the SQL
 * keyword `NULL` (unquoted), matching the prior `quoteLit` in schemaDiffService.
 */
export function quoteLit(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    return `'${String(value).replace(/'/g, "''")}'`;
}
