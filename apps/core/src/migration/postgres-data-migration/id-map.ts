import { eq } from 'drizzle-orm'
import type { ObjectId } from 'mongodb'

import { mongoIdMap } from '~/database/schema'

import type { MigrationContext } from './types'

const ensureCollectionMap = (
  ctx: MigrationContext,
  collection: string,
): Map<string, bigint> => {
  let map = ctx.idMap.get(collection)
  if (!map) {
    map = new Map()
    ctx.idMap.set(collection, map)
  }
  return map
}

export function mongoHexOf(
  value: ObjectId | string | null | undefined,
): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof (value as ObjectId).toHexString === 'function') {
    return (value as ObjectId).toHexString()
  }
  return String(value)
}

/** Allocate Snowflake IDs for every document in a Mongo collection. */
export async function allocateForCollection(
  ctx: MigrationContext,
  collection: string,
): Promise<number> {
  const cursor = ctx.mongo
    .collection(collection)
    .find({}, { projection: { _id: 1 } })
  const map = ensureCollectionMap(ctx, collection)
  let allocated = 0
  for await (const doc of cursor) {
    const hex = mongoHexOf(doc._id as ObjectId)
    if (!hex) continue
    if (map.has(hex)) continue
    map.set(hex, ctx.snowflake.nextBigInt())
    allocated++
  }
  ctx.reports.rowsRead[collection] =
    (ctx.reports.rowsRead[collection] ?? 0) + allocated
  return allocated
}

/** Persist the in-memory id map into the `mongo_id_map` table (apply mode only). */
export async function persistIdMap(ctx: MigrationContext): Promise<void> {
  if (ctx.mode !== 'apply') return
  for (const [collection, mapping] of ctx.idMap) {
    if (mapping.size === 0) continue
    const rows = Array.from(mapping.entries()).map(([hex, snowflake]) => ({
      collection,
      mongoId: hex,
      snowflakeId: snowflake,
    }))
    // Chunk to avoid overlong parameter lists.
    const chunkSize = 500
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      await ctx.pg.insert(mongoIdMap).values(chunk).onConflictDoNothing()
    }
  }
}

/** Resolve a Mongo `_id` reference into the allocated Snowflake bigint. */
export function resolveRef(
  ctx: MigrationContext,
  collection: string,
  mongoId: ObjectId | string | null | undefined,
  options: { field: string; required: boolean; sourceCollection: string },
): bigint | null {
  const hex = mongoHexOf(mongoId)
  if (!hex) {
    if (options.required) {
      ctx.reports.missingRefs.push({
        collection: options.sourceCollection,
        field: options.field,
        mongoId: 'null',
      })
    }
    return null
  }
  const target = ctx.idMap.get(collection)?.get(hex)
  if (!target) {
    ctx.reports.missingRefs.push({
      collection: options.sourceCollection,
      field: options.field,
      mongoId: hex,
    })
    return null
  }
  return target
}

/** Hydrate idMap from the persisted `mongo_id_map` rows (resumable runs). */
export async function loadPersistedMap(
  ctx: MigrationContext,
  collection: string,
): Promise<number> {
  const rows = await ctx.pg
    .select()
    .from(mongoIdMap)
    .where(eq(mongoIdMap.collection, collection))
  const map = ensureCollectionMap(ctx, collection)
  for (const row of rows) {
    map.set(row.mongoId, row.snowflakeId)
  }
  return rows.length
}

export type IdMapResolver = ReturnType<typeof createResolver>

export function createResolver(
  ctx: MigrationContext,
  sourceCollection: string,
) {
  return {
    self(mongoId: ObjectId | string): bigint {
      const hex = mongoHexOf(mongoId)!
      const target = ctx.idMap.get(sourceCollection)?.get(hex)
      if (!target) {
        throw new Error(
          `Snowflake id missing for ${sourceCollection}/${hex}; allocate phase must run first`,
        )
      }
      return target
    },
    ref(
      collection: string,
      mongoId: ObjectId | string | null | undefined,
      field: string,
      required = false,
    ): bigint | null {
      return resolveRef(ctx, collection, mongoId, {
        field,
        required,
        sourceCollection,
      })
    },
  }
}

export { ensureCollectionMap }
