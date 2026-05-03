#!/usr/bin/env node
/**
 * Fix comments.reader_id after Mongo→PG migration.
 *
 * The migration inadvertently stored Snowflake bigint IDs in comments.reader_id
 * while readers.id remained MongoDB hex strings. This script remaps
 * comments.reader_id back to hex strings via mongo_id_map, then alters the
 * column type to text to match the schema.
 *
 * Usage:
 *   tsx scripts/fix-comment-reader-ids.ts --mode dry-run
 *   tsx scripts/fix-comment-reader-ids.ts --mode apply
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

process.argv = [process.argv[0], process.argv[1]]

async function main() {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { eq, sql } = await import('drizzle-orm')
  const { Pool } = await import('pg')
  const { comments, mongoIdMap } = await import('../src/database/schema')
  const { POSTGRES } = await import('../src/app.config')

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

  console.log(`Fix comments.reader_id (${mode})`)

  // 1. Load reader mappings: snowflake_id -> mongo_id
  const mapRows = await db
    .select()
    .from(mongoIdMap)
    .where(eq(mongoIdMap.collection, 'readers'))
  const snowflakeToHex = new Map<string, string>()
  for (const row of mapRows) {
    snowflakeToHex.set(row.snowflakeId.toString(), row.mongoId)
  }
  console.log(`  loaded ${snowflakeToHex.size} reader mappings`)

  // 2. Find all comments with a non-null reader_id.
  const rowsWithReader = await db
    .select({ id: comments.id, readerId: comments.readerId })
    .from(comments)
    .where(sql`${comments.readerId} is not null`)
  console.log(`  found ${rowsWithReader.length} comments with reader_id`)

  const toUpdate: Array<{ id: bigint; readerId: string }> = []
  const skipped: Array<{ id: bigint; reason: string }> = []

  for (const row of rowsWithReader) {
    const current = row.readerId
    if (
      typeof current !== 'string' &&
      typeof current !== 'number' &&
      typeof current !== 'bigint'
    ) {
      continue
    }
    const currentStr = String(current)

    // If already a 24-char hex, skip.
    if (/^[\da-f]{24}$/i.test(currentStr)) {
      continue
    }

    // Otherwise treat as Snowflake ID and look up hex.
    const hex = snowflakeToHex.get(currentStr)
    if (hex) {
      toUpdate.push({ id: row.id, readerId: hex })
    } else {
      skipped.push({ id: row.id, reason: `no hex mapping for ${currentStr}` })
    }
  }

  console.log(`  rows to update: ${toUpdate.length}`)
  console.log(`  rows skipped: ${skipped.length}`)

  if (mode === 'dry-run') {
    console.log('\n  (dry-run — no changes written)')
    if (toUpdate.length > 0) {
      console.log('  sample:', toUpdate[0])
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

  // 3. Alter column type to text first so drizzle updates work.
  const { rows: typeRows } = await pool.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = 'comments' AND column_name = 'reader_id'`,
  )
  const currentType = typeRows[0]?.data_type
  if (currentType === 'bigint') {
    console.log('  altering comments.reader_id from bigint to text...')
    await pool.query(
      `ALTER TABLE comments ALTER COLUMN reader_id TYPE text USING reader_id::text`,
    )
    console.log('  column type altered to text')
  } else {
    console.log(`  column type already ${currentType}, no alter needed`)
  }

  // 4. Apply updates.
  let updatedCount = 0
  const chunkSize = 200
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map(({ id, readerId }) =>
        db.update(comments).set({ readerId }).where(eq(comments.id, id)),
      ),
    )
    updatedCount += chunk.length
  }

  console.log(`\n  updated: ${updatedCount}`)
  console.log('  ✅ Done')

  await pool.end()
}

main().catch((err) => {
  console.error('fix-comment-reader-ids failed:', err)
  process.exit(1)
})
