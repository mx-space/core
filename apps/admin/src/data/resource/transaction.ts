import { produce } from 'immer'

import type { Collection } from './collection'

export interface TransactionResult {
  fulfilledKeys?: string[]
}

export interface ResourceTransaction {
  update: <T extends object>(
    collection: Collection<T>,
    id: string,
    recipe: (draft: T) => void,
  ) => this
  delete: <T extends object>(collection: Collection<T>, id: string) => this
  insert: <T extends object>(collection: Collection<T>, entity: T) => this
  commit: <R extends TransactionResult | void>(
    request: () => Promise<R>,
  ) => Promise<R>
}

interface Registration {
  entityId: string
  commitOp: () => void
  rollbackOp: (error?: unknown) => void
}

export function createTransaction(): ResourceTransaction {
  const registrations: Registration[] = []
  let committed = false

  function assertNotCommitted() {
    if (committed) {
      throw new Error('[transaction] cannot register ops after commit')
    }
  }

  const tx: ResourceTransaction = {
    update<T extends object>(
      collection: Collection<T>,
      id: string,
      recipe: (draft: T) => void,
    ) {
      assertNotCommitted()
      const current = collection.get(id)
      if (current === undefined) {
        throw new Error(
          `[collection:${collection.name}] update on unknown entity ${id}`,
        )
      }

      const next = produce(current, recipe as (draft: T) => void) as T
      const patch: Partial<T> = {}
      for (const key of Object.keys(next) as (keyof T)[]) {
        if (!Object.is(next[key], current[key])) {
          patch[key] = next[key]
        }
      }

      const opId = collection._ops.begin({
        kind: 'update',
        entityId: id,
        patch,
      })
      registrations.push({
        entityId: id,
        commitOp: () => collection._ops.commit(opId, next),
        rollbackOp: (error) => collection._ops.rollback(opId, error),
      })
      return tx
    },
    delete<T extends object>(collection: Collection<T>, id: string) {
      assertNotCommitted()
      const opId = collection._ops.begin({ kind: 'delete', entityId: id })
      registrations.push({
        entityId: id,
        commitOp: () => collection._ops.commit(opId),
        rollbackOp: (error) => collection._ops.rollback(opId, error),
      })
      return tx
    },
    insert<T extends object>(collection: Collection<T>, entity: T) {
      assertNotCommitted()
      const id = collection.getKey(entity)
      const opId = collection._ops.begin({
        kind: 'insert',
        entityId: id,
        entity,
      })
      registrations.push({
        entityId: id,
        commitOp: () => collection._ops.commit(opId, entity),
        rollbackOp: (error) => collection._ops.rollback(opId, error),
      })
      return tx
    },
    async commit<R extends TransactionResult | void>(
      request: () => Promise<R>,
    ) {
      assertNotCommitted()
      committed = true

      let result: R
      try {
        result = await request()
      } catch (error) {
        for (const registration of registrations) {
          registration.rollbackOp(error)
        }
        throw error
      }

      const fulfilledKeys =
        result && typeof result === 'object' && 'fulfilledKeys' in result
          ? result.fulfilledKeys
          : undefined

      for (const registration of registrations) {
        if (!fulfilledKeys || fulfilledKeys.includes(registration.entityId)) {
          registration.commitOp()
        } else {
          registration.rollbackOp()
        }
      }

      return result
    },
  }

  return tx
}
