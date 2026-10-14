/** Read-only guard for the PulseDB Agent (see pulsedb-agent.mjs). */

// Read-only guard: monitoring and SELECT/WITH console queries only, unless the
// config sets "allowWrites": true. String literals and comments are blanked
// first so text like 'DROP' inside a value does not trip it.
//
// Besides SELECT/WITH, a batch may read the SQL Server error log into a table
// variable (how PulseDB lists failed logins): SET NOCOUNT ON, DECLARE @t TABLE,
// and INSERT INTO @t EXEC xp_readerrorlog/sp_readerrorlog. Table variables live
// only for the batch, so nothing in the database changes.
const WRITE_KEYWORDS =
    /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|SHUTDOWN|KILL|DBCC|BULK|INTO|OPENROWSET|OPENDATASOURCE|RECONFIGURE)\b/i;
const SAFE_STATEMENTS = [
    /^SET\s+NOCOUNT\s+(ON|OFF)$/i,
    /^DECLARE\s+@\w+\s+TABLE\s*\([^;]*\)$/i,
    /^INSERT\s+INTO\s+@\w+\s+EXEC(UTE)?\s+(sys\.)?(xp|sp)_readerrorlog(\s+[\w'\s,]*)?$/i,
];
export function assertReadOnly(sqlText) {
    const stripped = String(sqlText)
        .replace(/'([^']|'')*'/g, "''")
        .replace(/--[^\n]*/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, ' ');
    const statements = stripped
        .split(';')
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const ok =
        statements.length > 0 &&
        statements.every((st) => {
            if (SAFE_STATEMENTS.some((re) => re.test(st))) {
                return !/^DECLARE/i.test(st) || !WRITE_KEYWORDS.test(st);
            }
            const first = st.split(' ')[0].toUpperCase();
            return ['SELECT', 'WITH'].includes(first) && !WRITE_KEYWORDS.test(st);
        });
    if (!ok) {
        throw new Error(
            'Blocked by the PulseDB Agent: only SELECT/WITH queries are allowed. Set "allowWrites": true in agent.config.json to permit changes.',
        );
    }
}
