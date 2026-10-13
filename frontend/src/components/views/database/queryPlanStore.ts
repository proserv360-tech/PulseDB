/**
 * queryPlanStore.ts
 * ─────────────────
 * Shared latest-analyzed-plan state between Query Optimizer (writer) and
 * Query Plan Viewer (reader). Both tabs live under "Query Analysis" in the
 * sidebar; before this store, the Plan Viewer was always empty because
 * nothing fed it data. Now the Optimizer publishes after every successful
 * analyze and the Plan Viewer reads on mount + on update.
 *
 * Storage: in-memory + localStorage. A page reload (or switching tabs in
 * the SPA) preserves the last plan. Cap the persisted value at a
 * reasonable size so a giant EXPLAIN doesn't bloat localStorage.
 *
 * Subscription is a simple Set-of-callbacks rather than pulling in a
 * Redux/Zustand dep — this is one value with one publisher.
 */

const KEY = 'pulsedb_latest_query_plan';
const MAX_BYTES = 512 * 1024; // cap localStorage payload at 512 KB

export type PlanRecord = {
    plan: any;
    query: string;
    analyzedAt: number;
} | null;

function readFromStorage(): PlanRecord {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.plan && parsed.analyzedAt) {
            return parsed as PlanRecord;
        }
        return null;
    } catch {
        return null;
    }
}

let _current: PlanRecord = readFromStorage();
const _subs = new Set<(p: PlanRecord) => void>();

function persist(rec: PlanRecord) {
    try {
        if (!rec) {
            localStorage.removeItem(KEY);
            return;
        }
        const serialised = JSON.stringify(rec);
        if (serialised.length > MAX_BYTES) {
            // Plan too big — keep in memory only.
            localStorage.removeItem(KEY);
            return;
        }
        localStorage.setItem(KEY, serialised);
    } catch {
        // localStorage may throw in private mode / quota-exceeded — fail silent.
    }
}

/** Publish a freshly analyzed plan. Optimizer calls this in handleAnalyze. */
export function setLatestPlan(plan: any, query: string): void {
    _current = { plan, query, analyzedAt: Date.now() };
    persist(_current);
    _subs.forEach((fn) => {
        try { fn(_current); } catch { /* subscriber errors must not break siblings */ }
    });
}

/** Synchronous accessor for initial render. */
export function getLatestPlan(): PlanRecord {
    return _current;
}

/** Subscribe to future updates. Returns an unsubscribe function. */
export function subscribeLatestPlan(fn: (p: PlanRecord) => void): () => void {
    _subs.add(fn);
    return () => { _subs.delete(fn); };
}

/** Clear (used by tests + a future "Clear last plan" UI affordance). */
export function clearLatestPlan(): void {
    _current = null;
    persist(null);
    _subs.forEach((fn) => {
        try { fn(null); } catch { /* swallow */ }
    });
}
