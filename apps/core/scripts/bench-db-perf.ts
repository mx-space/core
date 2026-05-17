#!/usr/bin/env node
/* eslint-disable no-console */
import { performance } from 'node:perf_hooks'
import process from 'node:process'

// Reset argv so app.config's commander does not consume script flags.
process.argv = [process.argv[0], process.argv[1]]

type BenchResult = {
  label: string
  max: number
  mean: number
  median: number
  min: number
  p95: number
  queries: number
}

const WARMUP_RUNS = 20
const MEASURED_RUNS = 100
const WRITE_RUNS = 200
const CONTENT_FORMAT = 'markdown'

function stats(
  label: string,
  durations: number[],
  queries: number,
): BenchResult {
  const sorted = [...durations].sort((a, b) => a - b)
  const sum = durations.reduce((acc, value) => acc + value, 0)
  return {
    label,
    max: sorted.at(-1) ?? 0,
    mean: sum / durations.length,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    min: sorted[0] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    queries: queries / durations.length,
  }
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function printTable(label: string, rows: BenchResult[]) {
  console.log(
    `| Label | Target | Mean ms | Median ms | p95 ms | Min ms | Max ms | Queries/call |`,
  )
  console.log(`| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`)
  for (const row of rows) {
    console.log(
      `| ${label} | ${row.label} | ${fmt(row.mean)} | ${fmt(row.median)} | ${fmt(row.p95)} | ${fmt(row.min)} | ${fmt(row.max)} | ${fmt(row.queries)} |`,
    )
  }
}

async function immediate() {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

async function main() {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { Pool } = await import('pg')
  const { sql } = await import('drizzle-orm')
  const schema = await import('../src/database/schema')
  const { POSTGRES } = await import('../src/app.config')
  const { PostRepository } = await import('../src/modules/post/post.repository')
  const { NoteRepository } = await import('../src/modules/note/note.repository')
  const { RecentlyRepository } =
    await import('../src/modules/recently/recently.repository')
  const { SnowflakeGenerator } = await import('@mx-space/db-schema/id')

  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    database: POSTGRES.database,
    host: POSTGRES.host,
    password: POSTGRES.password,
    port: POSTGRES.port,
    ssl: POSTGRES.ssl,
    user: POSTGRES.user,
    max: 8,
  })
  const db = drizzle(pool, { schema, casing: 'snake_case' })
  const snowflake = new SnowflakeGenerator({ workerId: 43 })
  const postRepository = new PostRepository(db as any, snowflake as any)
  const noteRepository = new NoteRepository(db as any, snowflake as any)
  const recentlyRepository = new RecentlyRepository(db as any, snowflake as any)

  let queryCount = 0
  const originalQuery = pool.query.bind(pool)
  pool.query = ((...args: Parameters<typeof pool.query>) => {
    queryCount += 1
    return originalQuery(...args)
  }) as typeof pool.query

  const bench = async (
    label: string,
    fn: () => Promise<unknown>,
    iterations = MEASURED_RUNS,
  ): Promise<BenchResult> => {
    for (let i = 0; i < WARMUP_RUNS; i++) {
      await fn()
      await immediate()
    }

    const durations: number[] = []
    let queries = 0
    for (let i = 0; i < iterations; i++) {
      queryCount = 0
      const start = performance.now()
      await fn()
      durations.push(performance.now() - start)
      queries += queryCount
      await immediate()
    }
    return stats(label, durations, queries)
  }

  try {
    const [{ id: categoryId }] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .limit(1)

    if (!categoryId) {
      throw new Error('seed data missing: categories table is empty')
    }

    await pool.query(
      'ANALYZE categories, topics, posts, notes, pages, comments, recentlies',
    )

    const label = process.env.MX_BENCH_LABEL ?? 'unspecified'
    const results: BenchResult[] = []

    results.push(
      await bench('GET /api/v2/aggregate', async () => {
        await Promise.all([
          postRepository.findRecent(6, { publishedOnly: true }),
          noteRepository.findRecent(6, { visibleOnly: true }),
          recentlyRepository.findRecent(6),
          postRepository.findRecent(5, { publishedOnly: true }),
          noteRepository.findRecent(5, { visibleOnly: true }),
          postRepository.findByYearForTimeline({
            publishedOnly: true,
            sort: 'desc',
            year: 2025,
          }),
          noteRepository.findByYearForTimeline({
            sort: 'desc',
            visibleOnly: true,
            year: 2025,
          }),
        ])
      }),
    )
    results.push(
      await bench('GET /api/v2/posts?page=1&size=10', async () => {
        await postRepository.list({ page: 1, publishedOnly: true, size: 10 })
      }),
    )
    results.push(
      await bench('GET /api/v2/notes', async () => {
        await noteRepository.listVisible(1, 10)
      }),
    )
    results.push(
      await bench('GET /api/v2/notes/latest', async () => {
        if ('findLatestVisiblePair' in noteRepository) {
          await (
            noteRepository as NoteRepository & {
              findLatestVisiblePair: () => Promise<unknown>
            }
          ).findLatestVisiblePair()
          return
        }
        const [latest] = await noteRepository.findRecent(1, {
          visibleOnly: true,
        })
        if (!latest) return
        await noteRepository.findByCreatedWindow(
          latest.createdAt,
          'before',
          1,
          {
            visibleOnly: true,
          },
        )
      }),
    )

    let writeSeq = 0
    results.push(
      await bench(
        'write posts x200',
        async () => {
          writeSeq += 1
          await postRepository.create({
            categoryId,
            contentFormat: CONTENT_FORMAT,
            slug: `bench-write-post-${label}-${process.pid}-${writeSeq}`,
            text: `Bench write post ${writeSeq}`,
            title: `Bench Write Post ${writeSeq}`,
          })
        },
        WRITE_RUNS,
      ),
    )
    results.push(
      await bench(
        'write notes x200',
        async () => {
          writeSeq += 1
          await noteRepository.create({
            contentFormat: CONTENT_FORMAT,
            slug: `bench-write-note-${label}-${process.pid}-${writeSeq}`,
            text: `Bench write note ${writeSeq}`,
            title: `Bench Write Note ${writeSeq}`,
          })
        },
        WRITE_RUNS,
      ),
    )

    printTable(label, results)

    const invalid = await db.execute<{ indexrelid: string }>(
      sql`SELECT indexrelid::regclass::text AS indexrelid FROM pg_index WHERE indisvalid = false`,
    )
    if (invalid.rows.length > 0) {
      console.error('\nInvalid indexes:')
      for (const row of invalid.rows) console.error(`- ${row.indexrelid}`)
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[bench-db-perf] failed:', error)
  process.exit(1)
})
