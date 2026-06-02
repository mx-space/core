#!/usr/bin/env node
/**
 * Backfill `comments.is_owner_reply` for historical replies authored by the
 * site owner. Required by the §6.1 "Awaiting" tab predicate in
 * docs/superpowers/specs/2026-06-02-admin-comments-redesign-design.md.
 *
 * Owner detection: a reader row with role='owner' (id + email) plus the
 * matching owner_profiles.mail. A reply is attributed to the owner when
 * (a) its readerId equals the owner reader id, OR (b) its `mail` matches the
 * owner email or owner_profiles.mail (case-insensitive). Root comments are
 * never owner replies — parent_comment_id IS NULL is excluded.
 *
 * Resumable: chunk-by-id (`id > lastId ORDER BY id LIMIT 1000`) means a SIGINT
 * just stops mid-batch; the next run picks up because already-updated rows no
 * longer match the read predicate (`is_owner_reply = FALSE`).
 *
 * Usage:
 *   tsx scripts/backfill-owner-reply.ts --mode dry-run
 *   tsx scripts/backfill-owner-reply.ts --mode apply
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

// Reset argv so app.config's commander parser does not see migration flags.
process.argv = [process.argv[0], process.argv[1]]

const BATCH_SIZE = 1000

interface OwnerIdentity {
  readerId: string | null
  mails: Set<string>
}

function lowerMail(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

export interface RunBackfillOptions {
  pool: import('pg').Pool
  mode: 'dry-run' | 'apply'
  batchSize?: number
  logger?: Pick<Console, 'log' | 'warn'>
}

export interface RunBackfillResult {
  scanned: number
  updated: number
  ownerReaderId: string | null
  ownerMails: string[]
}

export async function runBackfill(
  options: RunBackfillOptions,
): Promise<RunBackfillResult> {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { and, asc, eq, isNotNull, sql, inArray, or } =
    await import('drizzle-orm')
  const { comments, readers, ownerProfiles } =
    await import('../src/database/schema')

  const logger = options.logger ?? console
  const batchSize = options.batchSize ?? BATCH_SIZE
  const db = drizzle(options.pool, { casing: 'snake_case' })

  // 1. Resolve owner identity (reader id + known mails).
  const ownerRows = await db
    .select({ id: readers.id, email: readers.email })
    .from(readers)
    .where(eq(readers.role, 'owner'))
    .orderBy(asc(readers.createdAt), asc(readers.id))
    .limit(1)
  const owner = ownerRows[0]

  const ownerProfile = owner
    ? (
        await db
          .select({ mail: ownerProfiles.mail })
          .from(ownerProfiles)
          .where(eq(ownerProfiles.readerId, owner.id))
          .limit(1)
      )[0]
    : undefined

  const mails = new Set<string>()
  const ownerEmail = lowerMail(owner?.email ?? null)
  const profileMail = lowerMail(ownerProfile?.mail ?? null)
  if (ownerEmail) mails.add(ownerEmail)
  if (profileMail) mails.add(profileMail)

  const identity: OwnerIdentity = {
    readerId: owner?.id ?? null,
    mails,
  }

  if (!identity.readerId && identity.mails.size === 0) {
    logger.warn(
      'backfill-owner-reply: no owner reader found and no owner mail known; nothing to backfill.',
    )
    return {
      scanned: 0,
      updated: 0,
      ownerReaderId: null,
      ownerMails: [],
    }
  }

  logger.log(
    `backfill-owner-reply (${options.mode}): owner reader=${identity.readerId ?? '<none>'} mails=[${[
      ...identity.mails,
    ].join(', ')}]`,
  )

  // 2. Count total candidates for ETA.
  const matchPredicate = or(
    identity.readerId ? eq(comments.readerId, identity.readerId) : sql`false`,
    identity.mails.size > 0
      ? inArray(sql`lower(${comments.mail})`, [...identity.mails])
      : sql`false`,
  )!

  const basePredicate = and(
    eq(comments.isOwnerReply, false),
    isNotNull(comments.parentCommentId),
    matchPredicate,
  )!

  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(basePredicate)
  const total = Number(totalRow[0]?.count ?? 0)
  logger.log(`backfill-owner-reply: ${total} candidate rows`)

  if (total === 0) {
    return {
      scanned: 0,
      updated: 0,
      ownerReaderId: identity.readerId,
      ownerMails: [...identity.mails],
    }
  }

  // 3. Walk by id ascending. Each iteration both reads and writes the same
  //    rows, so a SIGINT is safe — the next read window naturally skips
  //    already-flipped rows.
  const started = Date.now()
  let scanned = 0
  let updated = 0
  let lastId = ''

  // Compare ids numerically. Snowflake decimals stored as text would still
  // sort lexicographically for equal-length values, but a bigint cast keeps
  // this correct for mixed-length historical ids from the Mongo era.
  while (true) {
    const chunk = await db
      .select({ id: comments.id })
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
    const ids = chunk.map((r) => r.id)
    lastId = ids.at(-1)!

    if (options.mode === 'apply') {
      const res = await db
        .update(comments)
        .set({ isOwnerReply: true })
        .where(inArray(comments.id, ids))
        .returning({ id: comments.id })
      updated += res.length
    }

    const elapsed = (Date.now() - started) / 1000
    const rate = scanned / Math.max(elapsed, 0.001)
    const remaining = Math.max(total - scanned, 0)
    const etaSec = rate > 0 ? Math.round(remaining / rate) : 0
    logger.log(
      `  ${scanned}/${total} (${Math.round((scanned / Math.max(total, 1)) * 100)}%) — ETA ${etaSec}s`,
    )
  }

  logger.log(
    options.mode === 'apply'
      ? `backfill-owner-reply: updated ${updated} rows`
      : `backfill-owner-reply (dry-run): would update ${scanned} rows`,
  )

  return {
    scanned,
    updated,
    ownerReaderId: identity.readerId,
    ownerMails: [...identity.mails],
  }
}

async function main() {
  const { Pool } = await import('pg')
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

  try {
    await runBackfill({ pool, mode })
  } finally {
    await pool.end()
  }
}

const isCliEntry = (() => {
  try {
    const entry = process.argv[1] ?? ''
    return entry.endsWith('backfill-owner-reply.ts')
  } catch {
    return false
  }
})()

if (isCliEntry) {
  main().catch((err) => {
    console.error('backfill-owner-reply failed:', err)
    process.exit(1)
  })
}
