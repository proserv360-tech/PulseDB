// @ts-nocheck — legacy JS migrated 2026-06-10; remove after typing this module (see docs/TS_MIGRATION.md)

// In-memory SQL console history.
// Extracted from server.ts.

import { v4 as uuid } from 'uuid';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HISTORY
// ─────────────────────────────────────────────────────────────────────────────
export const queryHistory = {
    entries: [],
    add(e) {
        this.entries.unshift({ id: uuid(), ts: new Date().toISOString(), favourite: false, ...e });
        if (this.entries.length > 200) this.entries.pop();
    },
    list(limit) {
        return this.entries.slice(0, limit);
    },
};
