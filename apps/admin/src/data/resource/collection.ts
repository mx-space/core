import { produce } from 'immer'
import type { StoreApi } from 'zustand/vanilla'
import { createStore } from 'zustand/vanilla'

import type { ListIndex } from './list-index'

export interface CollectionConfig<T extends object> {
  name: string
  getKey: (entity: T) => string
  merge?: (prev: T, next: T) => T
  normalize?: (entity: T) => void
  onInsert?: (args: { entity: T }) => Promise<T | void>
  onUpdate?: (args: {
    id: string
    patch: Partial<T>
    next: T
  }) => Promise<T | void>
  onDelete?: (args: { id: string }) => Promise<void>
}

export interface PendingOp<T extends object> {
  opId: string
  kind: 'insert' | 'update' | 'delete'
  entityId: string
  patch?: Partial<T>
  entity?: T
}

export interface CollectionState<T extends object> {
  entitiesById: Record<string, T>
  versionByKey: Record<string, number>
  pendingOpsByKey: Record<string, PendingOp<T>[]>
  errorsByKey: Record<string, unknown>
  listIndexes: Record<string, ListIndex>
}

export interface Collection<T extends object> {
  name: string
  store: StoreApi<CollectionState<T>>
  getKey: (entity: T) => string
  get: (id: string) => T | undefined
  getBase: (id: string) => T | undefined
  hydrate: (entities: T[]) => void
  upsert: (entity: T) => void
  update: (id: string, recipe: (draft: T) => void) => Promise<T | void>
  insert: (entity: T) => Promise<T | void>
  delete: (id: string) => Promise<void>
  reset: () => void
  _ops: {
    begin: (op: Omit<PendingOp<T>, 'opId'>) => string
    commit: (opId: string, serverEcho?: T) => void
    rollback: (opId: string, error?: unknown) => void
  }
}

let opCounter = 0

interface Resettable {
  reset: () => void
}

const registeredCollections = new Set<Resettable>()

export function resetAllCollections(): void {
  for (const collection of registeredCollections) {
    collection.reset()
  }
}

function createInitialState<T extends object>(): CollectionState<T> {
  return {
    entitiesById: {},
    versionByKey: {},
    pendingOpsByKey: {},
    errorsByKey: {},
    listIndexes: {},
  }
}

function applyRecipe<T extends object>(base: T, recipe: (draft: T) => void): T {
  return produce(base, recipe as (draft: T) => void) as T
}

export function deriveUpdate<T extends object>(
  current: T,
  recipe: (draft: T) => void,
): { next: T; patch: Partial<T> } {
  const next = applyRecipe(current, recipe)
  const patch: Partial<T> = {}
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (!Object.is(next[key], current[key])) {
      patch[key] = next[key]
    }
  }
  return { next, patch }
}

export function defineCollection<T extends object>(
  config: CollectionConfig<T>,
): Collection<T> {
  const { name, getKey, merge, normalize, onInsert, onUpdate, onDelete } =
    config

  const store = createStore<CollectionState<T>>()(() => createInitialState<T>())

  function withNextVersion(
    versionByKey: Record<string, number>,
    id: string,
  ): Record<string, number> {
    return { ...versionByKey, [id]: (versionByKey[id] ?? 0) + 1 }
  }

  function withoutError(
    errorsByKey: Record<string, unknown>,
    id: string,
  ): Record<string, unknown> {
    if (!(id in errorsByKey)) return errorsByKey
    const next = { ...errorsByKey }
    delete next[id]
    return next
  }

  function getBase(id: string): T | undefined {
    return store.getState().entitiesById[id]
  }

  function get(id: string): T | undefined {
    const state = store.getState()
    let visible: T | undefined = state.entitiesById[id]
    const ops = state.pendingOpsByKey[id]
    if (!ops || ops.length === 0) return visible

    for (const op of ops) {
      switch (op.kind) {
        case 'update': {
          visible = { ...visible, ...op.patch }
          break
        }
        case 'delete': {
          return undefined
        }
        case 'insert': {
          if (visible === undefined && op.entity !== undefined) {
            visible = op.entity
          }
          break
        }
      }
    }
    return visible
  }

  function upsertToBase(entity: T) {
    const id = getKey(entity)
    store.setState((state) => {
      const prev = state.entitiesById[id]
      const merged = prev
        ? merge
          ? merge(prev, entity)
          : { ...prev, ...entity }
        : entity
      return {
        entitiesById: { ...state.entitiesById, [id]: merged },
        versionByKey: withNextVersion(state.versionByKey, id),
        errorsByKey: withoutError(state.errorsByKey, id),
      }
    })
  }

  function hydrate(entities: T[]) {
    for (const entity of entities) {
      normalize?.(entity)
      upsertToBase(entity)
    }
  }

  function upsert(entity: T) {
    upsertToBase(entity)
  }

  function begin(op: Omit<PendingOp<T>, 'opId'>): string {
    const opId = `op-${opCounter++}`
    store.setState((state) => {
      const list = state.pendingOpsByKey[op.entityId] ?? []
      return {
        pendingOpsByKey: {
          ...state.pendingOpsByKey,
          [op.entityId]: [...list, { ...op, opId }],
        },
        versionByKey: withNextVersion(state.versionByKey, op.entityId),
        errorsByKey: withoutError(state.errorsByKey, op.entityId),
      }
    })
    return opId
  }

  function removeOp(entityId: string, opId: string) {
    store.setState((state) => {
      const list = state.pendingOpsByKey[entityId]
      if (!list) return state

      const filtered = list.filter((op) => op.opId !== opId)
      const pendingOpsByKey = { ...state.pendingOpsByKey }
      if (filtered.length > 0) {
        pendingOpsByKey[entityId] = filtered
      } else {
        delete pendingOpsByKey[entityId]
      }

      return {
        pendingOpsByKey,
        versionByKey: withNextVersion(state.versionByKey, entityId),
      }
    })
  }

  function findOp(
    opId: string,
  ): { entityId: string; op: PendingOp<T> } | undefined {
    const state = store.getState()
    for (const [entityId, ops] of Object.entries(state.pendingOpsByKey)) {
      const op = ops.find((candidate) => candidate.opId === opId)
      if (op) return { entityId, op }
    }
    return undefined
  }

  function commit(opId: string, serverEcho?: T) {
    const found = findOp(opId)
    if (!found) return
    const { entityId, op } = found

    removeOp(entityId, opId)

    if (op.kind === 'delete') {
      store.setState((state) => {
        const entitiesById = { ...state.entitiesById }
        delete entitiesById[entityId]
        return {
          entitiesById,
          errorsByKey: withoutError(state.errorsByKey, entityId),
          versionByKey: withNextVersion(state.versionByKey, entityId),
        }
      })
      return
    }

    if (serverEcho !== undefined) {
      upsertToBase(serverEcho)
    }
  }

  function rollback(opId: string, error?: unknown) {
    const found = findOp(opId)
    if (!found) return
    const { entityId } = found

    removeOp(entityId, opId)
    if (error === undefined) return
    store.setState((state) => ({
      errorsByKey: { ...state.errorsByKey, [entityId]: error },
    }))
  }

  async function update(
    id: string,
    recipe: (draft: T) => void,
  ): Promise<T | void> {
    const current = get(id)
    if (current === undefined) {
      throw new Error(`[collection:${name}] update on unknown entity ${id}`)
    }

    const { next, patch } = deriveUpdate(current, recipe)

    const opId = begin({ kind: 'update', entityId: id, patch })

    if (!onUpdate) {
      commit(opId, next)
      return next
    }

    try {
      const echo = await onUpdate({ id, patch, next })
      commit(opId, echo ?? next)
      return echo ?? next
    } catch (error) {
      rollback(opId, error)
      throw error
    }
  }

  async function insert(entity: T): Promise<T | void> {
    const id = getKey(entity)
    const opId = begin({ kind: 'insert', entityId: id, entity })

    if (!onInsert) {
      commit(opId, entity)
      return entity
    }

    try {
      const echo = await onInsert({ entity })
      commit(opId, echo ?? entity)
      return echo ?? entity
    } catch (error) {
      rollback(opId, error)
      throw error
    }
  }

  async function del(id: string): Promise<void> {
    const opId = begin({ kind: 'delete', entityId: id })

    if (!onDelete) {
      commit(opId)
      return
    }

    try {
      await onDelete({ id })
      commit(opId)
    } catch (error) {
      rollback(opId, error)
      throw error
    }
  }

  function reset() {
    store.setState(createInitialState<T>(), true)
  }

  const collection: Collection<T> = {
    name,
    store,
    getKey,
    get,
    getBase,
    hydrate,
    upsert,
    update,
    insert,
    delete: del,
    reset,
    _ops: { begin, commit, rollback },
  }

  registeredCollections.add(collection)

  return collection
}
