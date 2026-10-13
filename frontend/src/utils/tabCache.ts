/**
 * tabCache — generic stale-while-revalidate cache for dashboard tabs.
 *
 * Mirrors the pattern OverviewTab already uses: persist a tab's last
 * fetched payload in localStorage so that when the user switches back to
 * the tab it renders instantly from cache while a fresh fetch runs in the
 * background. Eliminates the blank "loading spinner on every mount" lag.
 *
 * Usage:
 *   const cached = readTabCache<MyShape>('performance', connId);
 *   const [data, setData] = useState(cached ?? null);
 *   const [loading, setLoading] = useState(!cached);
 *   ...after a successful fetch:
 *   writeTabCache('performance', connId, freshData);
 */

const PREFIX = 'fathom_tabcache_';
const DEFAULT_TTL = 120_000; // 2 minutes, matches OverviewTab

interface CacheEnvelope<T> {
  _ts: number;
  data: T;
}

function keyFor(tabId: string, connId?: string | number | null): string {
  return `${PREFIX}${tabId}${connId != null ? `_${connId}` : ''}`;
}

/**
 * Read a tab's cached payload. Returns null if absent, unparseable, or
 * older than ttlMs (default 2 min).
 */
export function readTabCache<T = unknown>(
  tabId: string,
  connId?: string | number | null,
  ttlMs: number = DEFAULT_TTL,
): T | null {
  try {
    const raw = localStorage.getItem(keyFor(tabId, connId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed._ts !== 'number') return null;
    if (Date.now() - parsed._ts > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/** Persist a tab's payload with a fresh timestamp. */
export function writeTabCache<T = unknown>(
  tabId: string,
  connId: string | number | null | undefined,
  data: T,
): void {
  try {
    const envelope: CacheEnvelope<T> = { _ts: Date.now(), data };
    localStorage.setItem(keyFor(tabId, connId), JSON.stringify(envelope));
  } catch {
    /* quota / serialization failure — caching is best-effort */
  }
}

/** Remove a single tab's cache (e.g. on manual hard-refresh). */
export function clearTabCache(tabId: string, connId?: string | number | null): void {
  try {
    localStorage.removeItem(keyFor(tabId, connId));
  } catch {
    /* ignore */
  }
}

/** Remove every tab cache entry (e.g. on logout or connection delete). */
export function clearAllTabCaches(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
