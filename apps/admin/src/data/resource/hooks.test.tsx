import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement, useEffect } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Collection } from './collection'
import { defineCollection } from './collection'
import type { EntityListResult } from './hooks'
import { useCollectionInfiniteQuery, useEntity, useEntityList } from './hooks'
import { serializeListKey } from './key'
import { hydrateList, readList } from './list-index'

interface TestEntity {
  id: string
  title?: string
}

function makeCollection(name = 'test'): Collection<TestEntity> {
  return defineCollection<TestEntity>({ name, getKey: (e) => e.id })
}

const mounted: (() => void)[] = []

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.()
  }
})

function mountEntity(
  collection: Collection<TestEntity>,
  id: string | undefined,
) {
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  const box: { value: TestEntity | undefined } = { value: undefined }

  function Probe({ id }: { id: string | undefined }) {
    const value = useEntity(collection, id)
    useEffect(() => {
      box.value = value
    })
    box.value = value
    return null
  }

  act(() => {
    root.render(createElement(Probe, { id }))
  })

  const unmount = () => {
    act(() => root.unmount())
    container.remove()
  }
  mounted.push(unmount)

  return {
    get value() {
      return box.value
    },
    rerender: (nextId: string | undefined) => {
      act(() => {
        root.render(createElement(Probe, { id: nextId }))
      })
    },
    unmount,
  }
}

function mountEntityList(
  collection: Collection<TestEntity>,
  initialQueryKey: readonly unknown[],
  options?: { keepPrevious?: boolean },
) {
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  const box: { value: EntityListResult<TestEntity> | undefined } = {
    value: undefined,
  }

  function Probe({ queryKey }: { queryKey: readonly unknown[] }) {
    const value = useEntityList(collection, queryKey, options)
    useEffect(() => {
      box.value = value
    })
    box.value = value
    return null
  }

  act(() => {
    root.render(createElement(Probe, { queryKey: initialQueryKey }))
  })

  const unmount = () => {
    act(() => root.unmount())
    container.remove()
  }
  mounted.push(unmount)

  return {
    get value() {
      return box.value as EntityListResult<TestEntity>
    },
    rerender: (queryKey: readonly unknown[]) => {
      act(() => {
        root.render(createElement(Probe, { queryKey }))
      })
    },
    unmount,
  }
}

describe('hydrateList / readList', () => {
  it('writes the entities and the list index; readList returns ids and pagination', () => {
    const collection = makeCollection()

    hydrateList(collection, 'k1', {
      items: [
        { id: '1', title: 'a' },
        { id: '2', title: 'b' },
      ],
      pagination: { page: 1, size: 20, total: 2, totalPages: 1 },
    })

    expect(collection.get('1')).toEqual({ id: '1', title: 'a' })
    expect(collection.get('2')).toEqual({ id: '2', title: 'b' })

    const index = readList(collection.store.getState(), collection, 'k1')
    expect(index?.ids).toEqual(['1', '2'])
    expect(index?.pagination).toEqual({
      page: 1,
      size: 20,
      total: 2,
      totalPages: 1,
    })
    expect(index?.updatedAt).toBeGreaterThan(0)
  })

  it('returns undefined for a key that was never hydrated', () => {
    const collection = makeCollection()
    expect(
      readList(collection.store.getState(), collection, 'missing'),
    ).toBeUndefined()
  })
})

describe('hydrateList append mode', () => {
  it('dedupe-concats incoming ids onto the existing index, preserving order', () => {
    const collection = makeCollection()

    hydrateList(collection, 'feed', {
      items: [
        { id: '1', title: 'a' },
        { id: '2', title: 'b' },
      ],
    })
    hydrateList(
      collection,
      'feed',
      {
        items: [
          { id: '2', title: 'b-updated' },
          { id: '3', title: 'c' },
        ],
      },
      { mode: 'append' },
    )

    const index = readList(collection.store.getState(), collection, 'feed')
    expect(index?.ids).toEqual(['1', '2', '3'])
    expect(collection.get('2')).toEqual({ id: '2', title: 'b-updated' })
  })

  it('behaves like a replace when there is no existing index yet', () => {
    const collection = makeCollection()

    hydrateList(
      collection,
      'feed',
      { items: [{ id: '1', title: 'a' }] },
      { mode: 'append' },
    )

    const index = readList(collection.store.getState(), collection, 'feed')
    expect(index?.ids).toEqual(['1'])
  })

  it('leaves replace mode (default and explicit) unchanged', () => {
    const collection = makeCollection()

    hydrateList(collection, 'feed', {
      items: [
        { id: '1', title: 'a' },
        { id: '2', title: 'b' },
      ],
    })
    hydrateList(
      collection,
      'feed',
      { items: [{ id: '3', title: 'c' }] },
      { mode: 'replace' },
    )

    const index = readList(collection.store.getState(), collection, 'feed')
    expect(index?.ids).toEqual(['3'])
  })
})

describe('hydrateList LRU eviction', () => {
  it('evicts the least-recently-used index at the 51st key; entities are untouched', () => {
    vi.useFakeTimers()
    try {
      const collection = makeCollection()
      const base = Date.now()

      for (let i = 0; i < 50; i++) {
        vi.setSystemTime(base + i)
        hydrateList(collection, `k${i}`, { items: [{ id: `e${i}` }] })
      }

      vi.setSystemTime(base + 50)
      hydrateList(collection, 'k50', { items: [{ id: 'e50' }] })

      const state = collection.store.getState()
      expect(Object.keys(state.listIndexes)).toHaveLength(50)
      expect(state.listIndexes.k0).toBeUndefined()
      expect(state.listIndexes.k50).toBeDefined()

      for (let i = 0; i < 50; i++) {
        expect(collection.get(`e${i}`)).toEqual({ id: `e${i}` })
      }
      expect(collection.get('e50')).toEqual({ id: 'e50' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useEntityList reference stability', () => {
  it('returns the same reference across an unrelated write; a new one once a member changes', () => {
    const collection = makeCollection()
    hydrateList(collection, serializeListKey(['list']), {
      items: [
        { id: '1', title: 'a' },
        { id: '2', title: 'b' },
      ],
    })
    collection.upsert({ id: 'other', title: 'x' })

    const harness = mountEntityList(collection, ['list'])
    const first = harness.value

    act(() => {
      collection.upsert({ id: 'other', title: 'y' })
    })
    expect(harness.value).toBe(first)

    act(() => {
      collection.upsert({ id: '1', title: 'updated' })
    })
    expect(harness.value).not.toBe(first)
    expect(harness.value.items.find((item) => item.id === '1')?.title).toBe(
      'updated',
    )
  })
})

describe('useEntityList missing index', () => {
  it('returns a stable EMPTY reference across reads and unrelated writes', () => {
    const collection = makeCollection()
    const harness = mountEntityList(collection, ['missing'])
    const first = harness.value

    expect(first.isHydrated).toBe(false)
    expect(first.items).toEqual([])

    act(() => {
      collection.upsert({ id: 'unrelated' })
    })
    expect(harness.value).toBe(first)
  })
})

describe('useEntityList keepPrevious', () => {
  it('falls back to the previous key items until the new key hydrates', () => {
    const collection = makeCollection()
    hydrateList(collection, serializeListKey(['a']), {
      items: [{ id: '1', title: 'from-a' }],
    })

    const harness = mountEntityList(collection, ['a'], {
      keepPrevious: true,
    })
    expect(harness.value.items.map((item) => item.id)).toEqual(['1'])

    harness.rerender(['b'])
    expect(harness.value.items.map((item) => item.id)).toEqual(['1'])
    expect(harness.value.isHydrated).toBe(true)

    act(() => {
      hydrateList(collection, serializeListKey(['b']), {
        items: [{ id: '2', title: 'from-b' }],
      })
    })
    expect(harness.value.items.map((item) => item.id)).toEqual(['2'])
  })
})

describe('useEntityList pending-delete filtering', () => {
  it('filters an entity mid pending-delete out of items', () => {
    const onDelete = () => new Promise<void>(() => {})
    const collection = defineCollection<TestEntity>({
      name: 'del-test',
      getKey: (e) => e.id,
      onDelete,
    })
    hydrateList(collection, serializeListKey(['list']), {
      items: [{ id: '1' }, { id: '2' }],
    })

    void collection.delete('1')

    const harness = mountEntityList(collection, ['list'])
    expect(harness.value.items.map((item) => item.id)).toEqual(['2'])
  })
})

describe('useEntity reference stability', () => {
  it('returns the same reference when the version is unchanged; a new value after commit', async () => {
    const onUpdate = vi.fn(({ next }: { next: TestEntity }) =>
      Promise.resolve(next),
    )
    const collection = defineCollection<TestEntity>({
      name: 'entity-test',
      getKey: (e) => e.id,
      onUpdate,
    })
    collection.hydrate([{ id: '1', title: 'a' }])

    const harness = mountEntity(collection, '1')
    const first = harness.value
    expect(first).toEqual({ id: '1', title: 'a' })

    act(() => {
      collection.upsert({ id: 'other', title: 'x' })
    })
    expect(harness.value).toBe(first)

    await act(async () => {
      await collection.update('1', (draft) => {
        draft.title = 'b'
      })
    })
    expect(harness.value).not.toBe(first)
    expect(harness.value?.title).toBe('b')
  })

  it('returns undefined for an undefined id with no subscription churn', () => {
    const collection = makeCollection()
    const harness = mountEntity(collection, undefined)
    expect(harness.value).toBeUndefined()

    act(() => {
      collection.upsert({ id: 'irrelevant' })
    })
    expect(harness.value).toBeUndefined()
  })
})

describe('useCollectionInfiniteQuery', () => {
  it('replaces the list index on the first page and appends on later pages', async () => {
    const collection = makeCollection()
    const queryClient = new QueryClient()
    const queryKey = ['feed'] as const
    const firstPage: TestEntity[] = [{ id: '1' }, { id: '2' }]
    const secondPage: TestEntity[] = [{ id: '2' }, { id: '3' }]

    const box: { fetchNextPage: (() => Promise<unknown>) | undefined } = {
      fetchNextPage: undefined,
    }

    function Probe() {
      const query = useCollectionInfiniteQuery(collection, {
        queryKey,
        initialPageParam: null as null | string,
        queryFn: (pageParam) =>
          Promise.resolve(pageParam === null ? firstPage : secondPage),
        getNextPageParam: (_lastResult, pageParam) =>
          pageParam === null ? '2' : undefined,
        toItems: (result) => result,
      })
      useEffect(() => {
        box.fetchNextPage = () => query.fetchNextPage()
      })
      return null
    }

    const container = document.createElement('div')
    document.body.append(container)
    const root: Root = createRoot(container)

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(Probe),
        ),
      )
      await Promise.resolve()
    })

    const listKey = serializeListKey(queryKey)
    expect(
      readList(collection.store.getState(), collection, listKey)?.ids,
    ).toEqual(['1', '2'])

    await act(async () => {
      await box.fetchNextPage?.()
    })

    expect(
      readList(collection.store.getState(), collection, listKey)?.ids,
    ).toEqual(['1', '2', '3'])

    act(() => root.unmount())
    container.remove()
  })
})
