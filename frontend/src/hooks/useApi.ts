/**
 * hooks/useApi.ts
 * TanStack Query hooks over the PulseDB API layer (utils/api.ts).
 *
 * useApiQuery shares its cache with imperative fetchData() calls because
 * both use apiQueryKey() and the singleton queryClient.
 *
 *   const { data, isLoading, error } = useApiQuery<Metrics>('/api/metrics', {
 *       refetchInterval: 10_000,           // polling
 *   })
 *
 *   const save = useApiMutation('POST', '/api/alerts')
 *   save.mutate({ name: 'cpu high' })      // auto-invalidates /api/alerts
 */
import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryOptions,
    type UseMutationOptions,
} from '@tanstack/react-query'
import { apiQueryKey, fetchDataFresh, postData, putData, patchData, deleteData } from '../utils/api'

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const MUTATORS: Record<Method, (path: string, body?: unknown) => Promise<unknown>> = {
    POST: postData,
    PUT: putData,
    PATCH: patchData,
    DELETE: (path: string) => deleteData(path),
}

export function useApiQuery<TData = unknown>(
    path: string,
    options: Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'> = {},
) {
    return useQuery<TData, Error>({
        queryKey: apiQueryKey(path),
        // fetchDataFresh: the query cache itself handles staleness/dedup —
        // going through fetchData() would double-cache.
        queryFn: () => fetchDataFresh(path) as Promise<TData>,
        ...options,
    })
}

export function useApiMutation<TBody = unknown, TData = unknown>(
    method: Method,
    path: string | ((body: TBody) => string),
    options: Omit<UseMutationOptions<TData, Error, TBody>, 'mutationFn'> & {
        /** Extra path prefixes to invalidate on success (the mutated path is always invalidated). */
        invalidates?: string[]
    } = {},
) {
    const qc = useQueryClient()
    const { invalidates = [], ...mutationOptions } = options
    return useMutation<TData, Error, TBody>({
        mutationFn: (body: TBody) => {
            const resolved = typeof path === 'function' ? path(body) : path
            return MUTATORS[method](resolved, body) as Promise<TData>
        },
        ...mutationOptions,
        onSuccess: (data, variables, ...rest: unknown[]) => {
            const resolved = typeof path === 'function' ? path(variables) : path
            for (const prefix of [resolved, ...invalidates]) {
                qc.invalidateQueries({
                    predicate: (q) =>
                        q.queryKey[0] === 'api' &&
                        typeof q.queryKey[1] === 'string' &&
                        (q.queryKey[1] as string).includes(prefix),
                })
            }
            ;(mutationOptions.onSuccess as ((...a: unknown[]) => unknown) | undefined)?.(data, variables, ...rest)
        },
    })
}
