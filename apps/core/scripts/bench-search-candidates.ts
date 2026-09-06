import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from '../src/database/schema'
import { SearchRepository } from '../src/modules/search/search.repository'
import { runSchemaMigrationFiles } from '../src/processors/database/schema-migrator'

const container = await new PostgreSqlContainer('postgres:17-alpine').start()
const pool = new Pool({
  connectionString: container.getConnectionUri(),
  max: 2,
})
try {
  await runSchemaMigrationFiles(
    pool,
    path.resolve(import.meta.dirname, '../src/database/migrations'),
  )
  const repo = new SearchRepository(
    drizzle(pool, { schema, casing: 'snake_case' }),
    {} as never,
  )
  await pool.query(`
    INSERT INTO search_documents
      (id, ref_type, ref_id, lang, title, search_text, modified_at)
    SELECT n::text, 'post', n::text, 'zh', 'Article ' || n,
      repeat(md5(n::text), 128) || CASE WHEN n % 100 = 0 THEN ' Needle' ELSE '' END,
      '2026-01-01'::timestamp + n * interval '1 minute'
    FROM generate_series(1, 2000) n
  `)
  const loadedBytes = Buffer.byteLength(
    JSON.stringify(await repo.findAll('post', 'zh')),
  )
  const before = async () => {
    const rows = await repo.findAll('post', 'zh')
    const regex = /needle/gi
    return rows
      .filter((row) => regex.test(row.title) || regex.test(row.searchText))
      .slice(0, 10)
  }
  const after = () =>
    repo.findByKeywordFragments('Needle', 'post', 'zh', false, 10)
  const oldIds = (await before()).map((row) => row.refId)
  const newRows = await after()
  assert.deepEqual(
    newRows.map((row) => row.refId),
    oldIds,
  )
  const oldTimes: number[] = [],
    newTimes: number[] = []
  for (let i = 0; i < 12; i++) {
    // Alternate order and discard two warmup pairs.
    for (const [fn, times] of i % 2
      ? ([
          [after, newTimes],
          [before, oldTimes],
        ] as const)
      : ([
          [before, oldTimes],
          [after, newTimes],
        ] as const)) {
      const start = performance.now()
      await fn()
      if (i >= 2) times.push(performance.now() - start)
    }
  }
  const median = (times: number[]) =>
    times.toSorted((a, b) => a - b)[Math.floor(times.length / 2)]
  const search = {
    corpus:
      '2000 documents, 4096-byte bodies; synthetic local PostgreSQL 17; candidate stage only',
    samples: 10,
    matchingIds: oldIds,
    before: {
      medianMs: median(oldTimes),
      fetchedRows: 2000,
      jsonBytes: loadedBytes,
    },
    after: {
      medianMs: median(newTimes),
      fetchedRows: newRows.length,
      jsonBytes: Buffer.byteLength(JSON.stringify(newRows)),
    },
  }
  const candidates = Array.from({ length: 20000 }, (_, i) =>
    String(1000000000 + i),
  )
  const matching = candidates.filter((_, i) => i % 2 === 0)
  const measure = (fn: () => string[]) => {
    const times = []
    let result: string[] = []
    for (let i = 0; i < 7; i++) {
      const start = performance.now()
      result = fn()
      if (i >= 2) times.push(performance.now() - start)
    }
    return { medianMs: median(times), result }
  }
  const array = measure(() => candidates.filter((id) => matching.includes(id)))
  const set = measure(() => {
    const ids = new Set(matching)
    return candidates.filter((id) => ids.has(id))
  })
  assert.deepEqual(array.result, set.result)
  const grouped = {
    candidates: candidates.length,
    matches: matching.length,
    sameIdsAndOrder: true,
    beforeMedianMs: array.medianMs,
    afterMedianMs: set.medianMs,
  }
  console.log(JSON.stringify({ search, grouped }, null, 2))
  if (process.env.BENCH_OUTPUT_DIR) {
    writeFileSync(
      path.join(process.env.BENCH_OUTPUT_DIR, 'search.json'),
      JSON.stringify(search, null, 2),
    )
    writeFileSync(
      path.join(process.env.BENCH_OUTPUT_DIR, 'grouped.json'),
      JSON.stringify(grouped, null, 2),
    )
  }
} finally {
  await pool.end()
  await container.stop()
}
