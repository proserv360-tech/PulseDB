/**
 * lib/queryClient.ts
 * Singleton TanStack QueryClient.
 *
 * Exported standalone (not just via the Provider) because utils/api.ts routes
 * ALL GET traffic through queryClient.fetchQuery — this replaces the previous
 * hand-rolled 5-second response cache and in-flight request deduplication.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // The backend runs as serverless functions (cold start 2-5s per
            // parallel request), so cached data is kept fresh-enough for 60s
            // and shown immediately on tab switches; pages that need live
            // data poll explicitly via refetchInterval.
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
            // Show the previous data while a refetch is in flight instead of
            // unmounting into a skeleton.
            placeholderData: (previousData: unknown) => previousData,
        },
        mutations: {
            retry: 0,
        },
    },
});

export default queryClient;
