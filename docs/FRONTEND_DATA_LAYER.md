# Frontend Data Layer — TanStack Query (2026-06-10)

All API data flow now goes through TanStack Query.

## Architecture

- `lib/queryClient.ts` — singleton QueryClient (staleTime 5s, matching the
  previous hand-rolled cache TTL). Provided app-wide in `main.tsx`.
- `utils/api.ts` — `fetchData()` routes through `queryClient.fetchQuery`, so
  the 173 existing imperative call sites get TanStack caching, in-flight
  deduplication, and mutation-driven invalidation with zero call-site changes.
  The old hand-rolled response cache and dedup maps were deleted.
  `postData/putData/patchData/deleteData` invalidate matching queries.
  `fetchDataFresh()` bypasses the cache.
- `hooks/useApi.ts` — `useApiQuery(path, opts)` / `useApiMutation(method, path)`
  for components. Hooks share the same cache keys (`apiQueryKey(path)`) as
  `fetchData`, so imperative and hook-based access never double-fetch.

## Migrating a component

Replace useEffect + useState fetch plumbing:

```tsx
const { data, isLoading, error } = useApiQuery<Metrics>('/api/metrics', {
    refetchInterval: 10_000,   // polling, replaces setInterval
})
const save = useApiMutation('POST', '/api/alerts', { invalidates: ['/api/alerts'] })
```

Query keys include the resolved path with `connectionId`, so switching the
active connection produces fresh cache entries automatically.

`WaitEventsChart.tsx` is the reference conversion. Components still calling
raw `fetch()` (auth flows, file downloads, a handful of view tabs) work
unchanged; convert view tabs to `useApiQuery` opportunistically.
