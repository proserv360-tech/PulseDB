/**
 * Serverless hosts must use Supabase's *transaction* pooler (port 6543), not the
 * session pooler (5432). In session mode every client holds a server slot for
 * its whole life, and the free tier allows 15 in total. A handful of warm
 * Vercel instances (dashboard requests, PulseDB Agent long-polls) then exhausts
 * it: every query fails with EMAXCONNSESSION, and logins with "Session
 * validation unavailable". Transaction mode shares the slots per transaction,
 * which suits short-lived functions.
 *
 * On Vercel a 5432 Supabase pooler URL is therefore rewritten to 6543 (same
 * host and credentials). PulseDB's own queries need no session state (no
 * LISTEN, advisory locks or session SETs on the admin database). Set
 * PULSEDB_KEEP_SESSION_POOLER=1 to opt out. Long-lived hosts, local dev and
 * migrations keep whatever the URL says.
 */
export function poolerConnectionString(url: string | undefined): string | undefined {
    if (!url || process.env.VERCEL !== '1' || process.env.PULSEDB_KEEP_SESSION_POOLER === '1') return url;
    try {
        const u = new URL(url);
        if (/\.pooler\.supabase\.com$/i.test(u.hostname) && (u.port === '5432' || u.port === '')) {
            u.port = '6543';
            return u.toString();
        }
    } catch {
        /* not a URL: leave it to pg to report */
    }
    return url;
}
