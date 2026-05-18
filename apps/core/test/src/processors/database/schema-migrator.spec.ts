import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createPgTestDatabase } from 'test/helper/pg-verify-url'

import { runSchemaMigrationFiles } from '~/processors/database/schema-migrator'

interface MigrationFixture {
  tag: string
  when: number
  sql: string
}

function writeMigrationsFolder(entries: MigrationFixture[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-schema-migrator-'))
  fs.mkdirSync(path.join(dir, 'meta'), { recursive: true })
  const journal = {
    version: '7',
    dialect: 'postgresql',
    entries: entries.map((entry, idx) => ({
      idx,
      version: '7',
      when: entry.when,
      tag: entry.tag,
      breakpoints: true,
    })),
  }
  fs.writeFileSync(
    path.join(dir, 'meta', '_journal.json'),
    JSON.stringify(journal, null, 2),
  )
  for (const entry of entries) {
    fs.writeFileSync(path.join(dir, `${entry.tag}.sql`), entry.sql)
  }
  return dir
}

describe('runSchemaMigrationFiles', () => {
  it('does not re-run a migration that was re-tagged with a later timestamp', async () => {
    const context = await createPgTestDatabase('mx_schema_migrator', {
      migrate: false,
    })
    try {
      const createSql =
        'CREATE TABLE "device_codes" ("id" text PRIMARY KEY NOT NULL);'

      const before = writeMigrationsFolder([
        { tag: '0000_device_codes', when: 2000, sql: createSql },
      ])
      await runSchemaMigrationFiles(context.pool, before)

      const reTagged = writeMigrationsFolder([
        { tag: '0001_device_codes', when: 3000, sql: createSql },
      ])

      await expect(
        runSchemaMigrationFiles(context.pool, reTagged),
      ).resolves.toBeUndefined()
    } finally {
      await context.close()
    }
  }, 60_000)

  it('realigns the ledger timestamp when an applied migration is re-tagged', async () => {
    const context = await createPgTestDatabase('mx_schema_migrator', {
      migrate: false,
    })
    try {
      const createSql =
        'CREATE TABLE "device_codes" ("id" text PRIMARY KEY NOT NULL);'

      const before = writeMigrationsFolder([
        { tag: '0000_device_codes', when: 2000, sql: createSql },
      ])
      await runSchemaMigrationFiles(context.pool, before)

      const reTagged = writeMigrationsFolder([
        { tag: '0001_device_codes', when: 3000, sql: createSql },
      ])
      await runSchemaMigrationFiles(context.pool, reTagged)

      const rows = await context.pool.query<{ created_at: string }>(
        'SELECT created_at FROM drizzle.__drizzle_migrations',
      )
      expect(rows.rows.map((row) => Number(row.created_at))).toEqual([3000])
    } finally {
      await context.close()
    }
  }, 60_000)

  it('runs a pending migration whose hash is not yet recorded', async () => {
    const context = await createPgTestDatabase('mx_schema_migrator', {
      migrate: false,
    })
    try {
      const deviceSql =
        'CREATE TABLE "device_codes" ("id" text PRIMARY KEY NOT NULL);'
      const first = writeMigrationsFolder([
        { tag: '0000_device_codes', when: 2000, sql: deviceSql },
      ])
      await runSchemaMigrationFiles(context.pool, first)

      const next = writeMigrationsFolder([
        { tag: '0000_device_codes', when: 2000, sql: deviceSql },
        {
          tag: '0001_posts',
          when: 3000,
          sql: 'CREATE TABLE "posts" ("id" text PRIMARY KEY NOT NULL);',
        },
      ])
      await runSchemaMigrationFiles(context.pool, next)

      const exists = await context.pool.query<{ reg: string | null }>(
        `SELECT to_regclass('public.posts') AS reg`,
      )
      expect(exists.rows[0]?.reg).toBe('posts')
    } finally {
      await context.close()
    }
  }, 60_000)

  it('backfills a below-waterline migration instead of re-running it', async () => {
    const context = await createPgTestDatabase('mx_schema_migrator', {
      migrate: false,
    })
    try {
      const deviceSql =
        'CREATE TABLE "device_codes" ("id" text PRIMARY KEY NOT NULL);'

      await context.pool.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
      await context.pool.query(
        'CREATE TABLE "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
      )
      await context.pool.query(deviceSql)
      await context.pool.query(
        `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ('legacy-waterline', 5000)`,
      )

      const folder = writeMigrationsFolder([
        { tag: '0000_device_codes', when: 2000, sql: deviceSql },
      ])

      await expect(
        runSchemaMigrationFiles(context.pool, folder),
      ).resolves.toBeUndefined()

      const recorded = await context.pool.query<{ count: string }>(
        'SELECT count(*) AS count FROM "drizzle"."__drizzle_migrations" WHERE created_at = 2000',
      )
      expect(Number(recorded.rows[0]?.count)).toBe(1)
    } finally {
      await context.close()
    }
  }, 60_000)
})
