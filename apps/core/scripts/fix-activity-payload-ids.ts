#!/usr/bin/env node
/**
 * Fix stale MongoDB ObjectIds inside activities.payload after the Mongo→PG migration.
 *
 * Activity / Analyzer rows already have Snowflake IDs; only the *references*
 * stored inside payload (roomName, id, etc.) may still hold old MongoDB ObjectIds.
 * This script remaps those references via mongo_id_map and updates the rows
 * in-place. Rows whose referenced documents no longer exist are left untouched.
 *
 * Usage:
 *   tsx scripts/fix-activity-payload-ids.ts --mode dry-run
 *   tsx scripts/fix-activity-payload-ids.ts --mode apply
 */
import process from 'node:process'

const cliArgs = process.argv.slice(2)
const mode = cliArgs.includes('--mode')
  ? (cliArgs[cliArgs.indexOf('--mode') + 1] as 'dry-run' | 'apply')
  : 'dry-run'

if (mode !== 'dry-run' && mode !== 'apply') {
  console.error(`unknown mode "${mode}" (expected dry-run | apply)`)
  process.exit(2)
}

// Reset argv so app.config's commander doesn't see migration flags.
process.argv = [process.argv[0], process.argv[1]]

const OBJECT_ID_REGEX = /^[\da-f]{24}$/i

function isMongoObjectId(value: string): boolean {
  // Must be 24-char hex AND NOT already a valid Snowflake EntityId string.
  return OBJECT_ID_REGEX.test(value) && !/^[1-9]\d{0,18}$/.test(value)
}

async function main() {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { Pool } = await import('pg')
  const { eq } = await import('drizzle-orm')
  const { activities, mongoIdMap } = await import('../src/database/schema')
  const { POSTGRES } = await import('../src/app.config')
  const { serializeEntityId } = await import('../src/shared/id/entity-id')

  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    host: POSTGRES.host,
    port: POSTGRES.port,
    user: POSTGRES.user,
    password: POSTGRES.password,
    database: POSTGRES.database,
    ssl: POSTGRES.ssl,
  })

  const db = drizzle(pool, { casing: 'snake_case' })

  console.log(`Fix activity payload IDs (${mode})`)

  // 1. Load the full mongo_id_map into memory.
  const mapRows = await db.select().from(mongoIdMap)
  const idMap = new Map<string, bigint>()
  for (const row of mapRows) {
    idMap.set(row.mongoId, row.snowflakeId)
  }
  console.log(`  loaded ${idMap.size} mongo_id_map entries`)

  // 2. Read every activity row.
  const allActivities = await db.select().from(activities)
  console.log(`  scanning ${allActivities.length} activities`)

  const toUpdate: Array<{ id: bigint; payload: Record<string, unknown> }> = []
  const skipped: Array<{ id: bigint; reason: string }> = []

  for (const row of allActivities) {
    if (!row.payload || typeof row.payload !== 'object') continue

    const payload = { ...(row.payload as Record<string, unknown>) }
    let changed = false

    // ---- ReadDuration: roomName (article-<mongoId>) ----
    if (typeof payload.roomName === 'string') {
      const prefix = 'article-'
      if (payload.roomName.startsWith(prefix)) {
        const oldId = payload.roomName.slice(prefix.length)
        if (isMongoObjectId(oldId)) {
          const newId = idMap.get(oldId)
          if (newId !== undefined) {
            payload.roomName = `${prefix}${serializeEntityId(newId)}`
            changed = true
          } else {
            skipped.push({
              id: row.id,
              reason: `roomName ref missing: ${oldId}`,
            })
          }
        }
      }
    }

    // ---- Like / other payload.id ----
    if (typeof payload.id === 'string' && isMongoObjectId(payload.id)) {
      const newId = idMap.get(payload.id)
      if (newId !== undefined) {
        payload.id = serializeEntityId(newId)
        changed = true
      } else {
        skipped.push({
          id: row.id,
          reason: `payload.id ref missing: ${payload.id}`,
        })
      }
    }

    // ---- readerId (optional) ----
    if (
      typeof payload.readerId === 'string' &&
      isMongoObjectId(payload.readerId)
    ) {
      const newId = idMap.get(payload.readerId)
      if (newId !== undefined) {
        payload.readerId = serializeEntityId(newId)
        changed = true
      } else {
        skipped.push({
          id: row.id,
          reason: `readerId ref missing: ${payload.readerId}`,
        })
      }
    }

    if (changed) {
      toUpdate.push({ id: row.id, payload })
    }
  }

  console.log(`  rows to update: ${toUpdate.length}`)
  console.log(`  rows skipped (missing ref): ${skipped.length}`)

  if (mode === 'dry-run') {
    console.log('\n  (dry-run — no changes written)')
    if (toUpdate.length > 0) {
      console.log(
        '  sample update payload:',
        JSON.stringify(toUpdate[0].payload),
      )
    }
    if (skipped.length > 0) {
      console.log(
        '  sample skipped:',
        skipped.slice(0, 5).map((s) => s.reason),
      )
    }
    await pool.end()
    return
  }

  // 3. Apply updates in batches.
  let updatedCount = 0
  const chunkSize = 200
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(({ id, payload }) =>
        db.update(activities).set({ payload }).where(eq(activities.id, id)),
      ),
    )
    updatedCount += chunk.length
  }

  console.log(`\n  updated: ${updatedCount}`)
  console.log('  ✅ Done')

  await pool.end()
}

main().catch((err) => {
  console.error('fix-activity-payload-ids failed:', err)
  process.exit(1)
})
