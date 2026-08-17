import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  applyPushRelayMigrations,
  PUSH_RELAY_MIGRATION_LOCK_KEY,
} from '../src/apply-migrations.js'

type QueryCall = { sql: string; params?: unknown[] }

const createFakeClient = (options?: {
  recorded?: string[]
  failOn?: (sql: string, params?: unknown[]) => boolean
}) => {
  const calls: QueryCall[] = []
  const recorded = new Set(options?.recorded ?? [])
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      if (options?.failOn?.(sql, params)) throw new Error('migration failed')
      if (
        /select\s+filename\s+from\s+push_relay_schema_migrations/i.test(sql)
      ) {
        return { rows: [...recorded].map((filename) => ({ filename })) }
      }
      if (/insert into push_relay_schema_migrations/i.test(sql)) {
        recorded.add(String(params?.[0]))
      }
      return { rows: [] }
    },
  }
  return { client, calls, recorded }
}

const sqlCalls = (calls: QueryCall[]) =>
  calls.map((call) => call.sql.replaceAll(/\s+/g, ' ').trim())

describe('applyPushRelayMigrations', () => {
  const dirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    )
  })

  const createMigrationDir = async (files: Record<string, string>) => {
    const dir = await mkdtemp(join(tmpdir(), 'push-relay-migrate-'))
    dirs.push(dir)
    await Promise.all(
      Object.entries(files).map(([name, sql]) =>
        writeFile(join(dir, name), sql),
      ),
    )
    return dir
  }

  it('applies pending files in sorted filename order and records them', async () => {
    const migrationsDir = await createMigrationDir({
      '0002_second.sql': "SELECT 'second'",
      '0001_first.sql': "SELECT 'first'",
      'README.md': 'ignore me',
    })
    const { client, calls } = createFakeClient()

    await expect(
      applyPushRelayMigrations(client, { migrationsDir }),
    ).resolves.toEqual({
      applied: ['0001_first.sql', '0002_second.sql'],
      skipped: [],
    })

    const executed = sqlCalls(calls)
    expect(executed[0]).toBe('BEGIN')
    expect(executed.at(-1)).toBe('COMMIT')
    const first = executed.indexOf("SELECT 'first'")
    const second = executed.indexOf("SELECT 'second'")
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    expect(calls).toContainEqual({
      sql: expect.stringMatching(/INSERT INTO push_relay_schema_migrations/),
      params: ['0001_first.sql'],
    })
    expect(calls).toContainEqual({
      sql: expect.stringMatching(/INSERT INTO push_relay_schema_migrations/),
      params: ['0002_second.sql'],
    })
  })

  it('skips filenames already in the ledger and does not re-execute them', async () => {
    const migrationsDir = await createMigrationDir({
      '0001_first.sql': "SELECT 'first'",
      '0002_second.sql': "SELECT 'second'",
    })
    const { client, calls } = createFakeClient({
      recorded: ['0001_first.sql'],
    })

    await expect(
      applyPushRelayMigrations(client, { migrationsDir }),
    ).resolves.toEqual({
      applied: ['0002_second.sql'],
      skipped: ['0001_first.sql'],
    })

    const executed = sqlCalls(calls)
    expect(executed).not.toContain("SELECT 'first'")
    expect(executed).toContain("SELECT 'second'")
  })

  it('takes a transaction-scoped advisory lock before mutating schema', async () => {
    const migrationsDir = await createMigrationDir({
      '0001_first.sql': "SELECT 'first'",
    })
    const { client, calls } = createFakeClient()

    await applyPushRelayMigrations(client, { migrationsDir })

    const executed = sqlCalls(calls)
    expect(executed[0]).toBe('BEGIN')
    expect(calls[1]).toEqual({
      sql: expect.stringMatching(/pg_advisory_xact_lock\(\$1(?:::bigint)?\)/),
      params: [PUSH_RELAY_MIGRATION_LOCK_KEY],
    })
    const lockIndex = 1
    const createIndex = executed.findIndex((sql) =>
      /CREATE TABLE IF NOT EXISTS push_relay_schema_migrations/.test(sql),
    )
    const fileIndex = executed.indexOf("SELECT 'first'")
    expect(createIndex).toBeGreaterThan(lockIndex)
    expect(fileIndex).toBeGreaterThan(createIndex)
    expect(executed.some((sql) => /\bpg_advisory_lock\(/.test(sql))).toBe(false)
  })

  it('rolls back the transaction when a pending file fails and does not commit', async () => {
    const migrationsDir = await createMigrationDir({
      '0001_first.sql': "SELECT 'first'",
      '0002_second.sql': "SELECT 'boom'",
    })
    const { client, calls } = createFakeClient({
      failOn: (sql) => sql.includes("'boom'"),
    })

    await expect(
      applyPushRelayMigrations(client, { migrationsDir }),
    ).rejects.toThrow('migration failed')

    const executed = sqlCalls(calls)
    expect(executed).toContain('ROLLBACK')
    expect(executed).not.toContain('COMMIT')
    expect(calls).not.toContainEqual({
      sql: expect.stringMatching(/INSERT INTO push_relay_schema_migrations/),
      params: ['0002_second.sql'],
    })
  })
})
