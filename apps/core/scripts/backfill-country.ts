#!/usr/bin/env node
/**
 * Backfill `comments.country_code` from `comments.ip` for historical rows.
 * Required by §6.4 in
 * docs/superpowers/specs/2026-06-02-admin-comments-redesign-design.md so the
 * admin list does not re-resolve geoip on every read.
 *
 * Reuses CommentCountryService.lookupCountryCode so the per-IP Redis cache
 * (30-day TTL) is populated as a side effect — subsequent re-runs are cheap.
 * Rows whose IP fails to resolve are skipped (country_code stays NULL); the
 * skip count is logged at the end and at every batch boundary.
 *
 * Resumable: chunk-by-id (`id > lastId ORDER BY id LIMIT 1000`). SIGINT stops
 * mid-batch; the next run picks up because already-populated rows fall out of
 * the read predicate (`country_code IS NULL`).
 *
 * Usage:
 *   tsx scripts/backfill-country.ts --mode dry-run
 *   tsx scripts/backfill-country.ts --mode apply
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

const BATCH_SIZE = 1000

export interface RunBackfillCountryOptions {
  pool: import('pg').Pool
  mode: 'dry-run' | 'apply'
  batchSize?: number
  lookup: (ip: string) => Promise<string | null>
  logger?: Pick<Console, 'log' | 'warn'>
}

export interface RunBackfillCountryResult {
  scanned: number
  resolved: number
  updated: number
  skipped: number
}

export async function runBackfill(
  options: RunBackfillCountryOptions,
): Promise<RunBackfillCountryResult> {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { and, eq, isNotNull, isNull, sql } = await import('drizzle-orm')
  const { comments } = await import('../src/database/schema')

  const logger = options.logger ?? console
  const batchSize = options.batchSize ?? BATCH_SIZE
  const db = drizzle(options.pool, { casing: 'snake_case' })

  const basePredicate = and(
    isNull(comments.countryCode),
    isNotNull(comments.ip),
  )!

  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(basePredicate)
  const total = Number(totalRow[0]?.count ?? 0)
  logger.log(`backfill-country (${options.mode}): ${total} candidate rows`)

  if (total === 0) {
    return { scanned: 0, resolved: 0, updated: 0, skipped: 0 }
  }

  const started = Date.now()
  let scanned = 0
  let resolved = 0
  let updated = 0
  let skipped = 0
  let lastId = ''

  while (true) {
    const chunk = await db
      .select({ id: comments.id, ip: comments.ip })
      .from(comments)
      .where(
        and(
          basePredicate,
          lastId === ''
            ? sql`true`
            : sql`${comments.id}::bigint > ${lastId}::bigint`,
        )!,
      )
      .orderBy(sql`${comments.id}::bigint`)
      .limit(batchSize)

    if (chunk.length === 0) break

    scanned += chunk.length
    lastId = chunk.at(-1)!.id

    // Resolve unique IPs within the batch; the underlying service cache
    // makes the duplicate-IP fast path effectively free.
    const uniqueIps = Array.from(
      new Set(chunk.map((r) => r.ip).filter((v): v is string => !!v)),
    )
    const ipToCountry = new Map<string, string | null>()
    for (const ip of uniqueIps) {
      const country = await options.lookup(ip)
      ipToCountry.set(ip, country)
      if (country) resolved++
    }

    for (const row of chunk) {
      const country = row.ip ? (ipToCountry.get(row.ip) ?? null) : null
      if (!country) {
        skipped++
        continue
      }
      if (options.mode === 'apply') {
        const res = await db
          .update(comments)
          .set({ countryCode: country })
          .where(and(eq(comments.id, row.id), isNull(comments.countryCode))!)
          .returning({ id: comments.id })
        if (res.length > 0) updated++
      } else {
        updated++
      }
    }

    const elapsed = (Date.now() - started) / 1000
    const rate = scanned / Math.max(elapsed, 0.001)
    const remaining = Math.max(total - scanned, 0)
    const etaSec = rate > 0 ? Math.round(remaining / rate) : 0
    logger.log(
      `  ${scanned}/${total} (${Math.round((scanned / Math.max(total, 1)) * 100)}%) resolved=${resolved} skipped=${skipped} — ETA ${etaSec}s`,
    )
  }

  logger.log(
    options.mode === 'apply'
      ? `backfill-country: updated ${updated} rows, skipped ${skipped}`
      : `backfill-country (dry-run): would update ${updated} rows, would skip ${skipped}`,
  )

  return { scanned, resolved, updated, skipped }
}

async function main() {
  const { Pool } = await import('pg')
  const { POSTGRES, REDIS } = await import('../src/app.config')
  const { default: IORedis } = await import('ioredis')
  const { ofetch } = await import('ofetch')
  const { CommentCountryService } =
    await import('../src/modules/comment/comment-country.service')

  const pool = new Pool({
    connectionString: POSTGRES.connectionString,
    host: POSTGRES.host,
    port: POSTGRES.port,
    user: POSTGRES.user,
    password: POSTGRES.password,
    database: POSTGRES.database,
    ssl: POSTGRES.ssl,
  })

  const redis = REDIS.url
    ? new IORedis(REDIS.url, {
        password: REDIS.password ?? undefined,
        ...(REDIS.tls ? { tls: {} } : {}),
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      })
    : new IORedis({
        host: REDIS.host,
        port: REDIS.port,
        password: REDIS.password ?? undefined,
        ...(REDIS.tls ? { tls: {} } : {}),
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      })

  const redisStub = { getClient: () => redis } as any
  const httpStub = { fetch: ofetch } as any
  const service = new CommentCountryService(redisStub, httpStub)

  try {
    await runBackfill({
      pool,
      mode,
      lookup: (ip) => service.lookupCountryCode(ip),
    })
  } finally {
    await pool.end()
    redis.disconnect()
  }
}

const isCliEntry = (() => {
  try {
    const entry = process.argv[1] ?? ''
    return entry.endsWith('backfill-country.ts')
  } catch {
    return false
  }
})()

if (isCliEntry) {
  main().catch((err) => {
    console.error('backfill-country failed:', err)
    process.exit(1)
  })
}
