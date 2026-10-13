/**
 * services/sqlReadGuard.ts
 * Shared read-only SQL guard (audit 2026-06-10, LOW-1 + MEDIUM-1 support).
 *
 * Keyword matching on raw SQL produced false positives (a literal
 * 'delete me' tripped the DELETE check) and could be fooled by comments.
 * stripSqlLiterals removes string/dollar-quoted literals and comments before
 * the keyword test, so the guard sees only executable tokens.
 */

/** Remove '...'/"..."/$tag$...$tag$ literals and -- / block comments. */
export function stripSqlLiterals(sql: string): string {
    let out = '';
    let i = 0;
    const n = sql.length;
    while (i < n) {
        const c = sql[i];
        const c2 = sql[i + 1];
        // line comment
        if (c === '-' && c2 === '-') {
            const nl = sql.indexOf('\n', i);
            i = nl === -1 ? n : nl;
            continue;
        }
        // block comment
        if (c === '/' && c2 === '*') {
            const end = sql.indexOf('*/', i + 2);
            i = end === -1 ? n : end + 2;
            out += ' ';
            continue;
        }
        // single / double quoted string
        if (c === "'" || c === '"') {
            i++;
            while (i < n) {
                if (sql[i] === c && sql[i + 1] === c) {
                    i += 2;
                    continue;
                } // escaped quote
                if (sql[i] === c) {
                    i++;
                    break;
                }
                i++;
            }
            out += ' ';
            continue;
        }
        // dollar-quoted string  $tag$ ... $tag$
        if (c === '$') {
            const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
            if (m) {
                const tag = m[0];
                const end = sql.indexOf(tag, i + tag.length);
                i = end === -1 ? n : end + tag.length;
                out += ' ';
                continue;
            }
        }
        out += c;
        i++;
    }
    return out;
}

const SELECT_ONLY = /^\s*(select|with)\b/i;
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|vacuum|copy|merge|call|do)\b/i;
const MULTI_STATEMENT = /;\s*\S/; // a ; followed by more tokens

/** True iff sql is a single read-only SELECT/CTE with no write keywords. */
export function isReadOnlySelect(sql: unknown): sql is string {
    if (typeof sql !== 'string') return false;
    const stripped = stripSqlLiterals(sql);
    // strip a single trailing semicolon, then a remaining ; means stacked SQL
    if (MULTI_STATEMENT.test(stripped.trim().replace(/;\s*$/, ''))) return false;
    return SELECT_ONLY.test(stripped) && !FORBIDDEN.test(stripped);
}
