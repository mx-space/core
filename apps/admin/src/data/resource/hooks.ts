import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryResult,
  UseQueryResult,
} from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

import type { Pager } from '~/models/base'

import type { Collection } from './collection'
import { serializeListKey } from './key'
import type { ListPage } from './list-index'
import { hydrateList, readList, touchList } from './list-index'

export function useEntity<T extends object>(
  collection: Collection<T>,
  id: string | undefined,
): T | undefined {
  const cache = useRef<{ id: string; version: number; value: T | undefined }>(
    undefined,
  )

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!id) return () => {}
      return collection.store.subscribe((state, prevState) => {
        if (state.versionByKey[id] !== prevState.versionByKey[id]) {
          onStoreChange()
        }
      })
    },
    [collection, id],
  )

  const getSnapshot = useCallback((): T | undefined => {
    if (!id) return undefined

    const version = collection.store.getState().versionByKey[id] ?? 0
    const cached = cache.current
    if (cached && cached.id === id && cached.version === version) {
      return cached.value
    }

    const value = collection.get(id)
    cache.current = { id, version, value }
    return value
  }, [collection, id])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export interface EntityListResult<T> {
  items: T[]
  pagination?: Pager
  updatedAt: number
  isHydrated: boolean
}

const EMPTY_LIST_RESULT: EntityListResult<never> = Object.freeze({
  items: Object.freeze([]) as never[],
  pagination: undefined,
  updatedAt: 0,
  isHydrated: false,
})

interface ListResultCache<T> {
  activeKey: string
  updatedAt: number
  versionSignature: string
  result: EntityListResult<T>
}

export function useEntityList<T extends object>(
  collection: Collection<T>,
  queryKey: readonly unknown[],
  options?: { keepPrevious?: boolean },
): EntityListResult<T> {
  const listKey = useMemo(() => serializeListKey(queryKey), [queryKey])
  const keepPrevious = options?.keepPrevious ?? false

  const lastHydratedKeyRef = useRef<string | undefined>(undefined)
  const activeKeyRef = useRef<string | undefined>(undefined)
  const touchedKeyRef = useRef<string | undefined>(undefined)
  const cacheRef = useRef<ListResultCache<T> | undefined>(undefined)

  const subscribe = useCallback(
    (onStoreChange: () => void) => collection.store.subscribe(onStoreChange),
    [collection],
  )

  const getSnapshot = useCallback((): EntityListResult<T> => {
    const state = collection.store.getState()

    let activeKey = listKey
    let index = readList(state, collection, listKey)

    if (!index && keepPrevious && lastHydratedKeyRef.current) {
      const previousIndex = readList(
        state,
        collection,
        lastHydratedKeyRef.current,
      )
      if (previousIndex) {
        activeKey = lastHydratedKeyRef.current
        index = previousIndex
      }
    }

    if (!index) {
      activeKeyRef.current = undefined
      return EMPTY_LIST_RESULT
    }

    if (activeKey === listKey) {
      lastHydratedKeyRef.current = listKey
    }
    activeKeyRef.current = activeKey

    const versionSignature = index.ids
      .map((id) => `${id}:${state.versionByKey[id] ?? 0}`)
      .join('|')

    const cached = cacheRef.current
    if (
      cached &&
      cached.activeKey === activeKey &&
      cached.updatedAt === index.updatedAt &&
      cached.versionSignature === versionSignature
    ) {
      return cached.result
    }

    const items: T[] = []
    for (const id of index.ids) {
      const entity = collection.get(id)
      if (entity !== undefined) items.push(entity)
    }

    const result: EntityListResult<T> = {
      items,
      pagination: index.pagination,
      updatedAt: index.updatedAt,
      isHydrated: true,
    }

    cacheRef.current = {
      activeKey,
      updatedAt: index.updatedAt,
      versionSignature,
      result,
    }

    return result
  }, [collection, listKey, keepPrevious])

  const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    const key = activeKeyRef.current
    if (key && touchedKeyRef.current !== key) {
      touchedKeyRef.current = key
      touchList(collection, key)
    }
  })

  return result
}

export interface CollectionQueryReceipt {
  hydratedAt: number
}

export function useCollectionListQuery<T extends object, TResult>(
  collection: Collection<T>,
  options: {
    queryKey: QueryKey
    queryFn: () => Promise<TResult>
    toPage: (result: TResult) => ListPage<T>
    enabled?: boolean
  },
): UseQueryResult<CollectionQueryReceipt> {
  const listKey = useMemo(
    () => serializeListKey(options.queryKey),
    [options.queryKey],
  )

  return useQuery({
    queryKey: options.queryKey,
    enabled: options.enabled,
    queryFn: async (): Promise<CollectionQueryReceipt> => {
      const result = await options.queryFn()
      const page = options.toPage(result)
      hydrateList(collection, listKey, page)
      return { hydratedAt: Date.now() }
    },
  })
}

export interface CollectionInfiniteReceipt<TPageParam> {
  hydratedAt: number
  nextPageParam: TPageParam | undefined
}

export function useCollectionInfiniteQuery<
  T extends object,
  TResult,
  TPageParam,
>(
  collection: Collection<T>,
  options: {
    queryKey: QueryKey
    queryFn: (pageParam: TPageParam) => Promise<TResult>
    getNextPageParam: (
      lastResult: TResult,
      pageParam: TPageParam,
    ) => TPageParam | undefined
    initialPageParam: TPageParam
    toItems: (result: TResult) => T[]
    enabled?: boolean
  },
): UseInfiniteQueryResult<
  InfiniteData<CollectionInfiniteReceipt<TPageParam>, TPageParam>
> {
  const listKey = useMemo(
    () => serializeListKey(options.queryKey),
    [options.queryKey],
  )

  return useInfiniteQuery<
    CollectionInfiniteReceipt<TPageParam>,
    Error,
    InfiniteData<CollectionInfiniteReceipt<TPageParam>, TPageParam>,
    QueryKey,
    TPageParam
  >({
    queryKey: options.queryKey,
    enabled: options.enabled,
    initialPageParam: options.initialPageParam,
    queryFn: async (context: {
      pageParam?: unknown
    }): Promise<CollectionInfiniteReceipt<TPageParam>> => {
      const pageParam = context.pageParam as TPageParam
      const result = await options.queryFn(pageParam)
      const items = options.toItems(result)
      hydrateList(
        collection,
        listKey,
        { items },
        { mode: pageParam ? 'append' : 'replace' },
      )
      return {
        hydratedAt: Date.now(),
        nextPageParam: options.getNextPageParam(result, pageParam),
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPageParam,
  })
}

export function useCollectionDetailQuery<T extends object, TResult = T>(
  collection: Collection<T>,
  options: {
    queryKey: QueryKey
    queryFn: () => Promise<TResult>
    toEntity?: (result: TResult) => T
    enabled?: boolean
  },
): UseQueryResult<CollectionQueryReceipt> {
  return useQuery({
    queryKey: options.queryKey,
    enabled: options.enabled,
    queryFn: async (): Promise<CollectionQueryReceipt> => {
      const result = await options.queryFn()
      const entity = options.toEntity
        ? options.toEntity(result)
        : (result as unknown as T)
      collection.hydrate([entity])
      return { hydratedAt: Date.now() }
    },
  })
}
