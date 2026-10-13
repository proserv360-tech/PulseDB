// React.lazy wrapper that recovers from stale chunk hashes after a deploy.
// Extracted from App.tsx.
import { lazy } from 'react';

/* ── Retry wrapper for lazy imports (handles stale chunk hashes after deploy) ── */
export const lazyRetry = (importFn) =>
    lazy(() =>
        importFn().catch((err) => {
            // Chunk fetch failed (likely stale hash after deploy) — force-reload once
            const key = 'fathom_chunk_retry';
            try {
                if (!sessionStorage.getItem(key)) {
                    sessionStorage.setItem(key, '1');
                    window.location.reload();
                    return new Promise(() => {}); // hang while reloading
                }
                sessionStorage.removeItem(key);
            } catch {
                /* sessionStorage unavailable — fall through */
            }
            // second attempt with cache-bust
            return importFn().catch(() => {
                // final fallback: hard reload with cache-bust query
                window.location.href = window.location.pathname + '?cb=' + Date.now();
                return new Promise(() => {});
            });
        }),
    );
