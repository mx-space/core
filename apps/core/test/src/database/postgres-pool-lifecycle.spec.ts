import { NestFactory } from '@nestjs/core'
import type { Pool } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PG_POOL_TOKEN } from '~/constants/system.constant'
import {
  __setTestPostgresInstance,
  type AppDatabase,
  createPool,
  db,
  disposePool,
  PostgresPoolLifecycle,
} from '~/processors/database/postgres.provider'

function makePool() {
  const end = vi.fn(async () => {})
  return { pool: { end } as unknown as Pool, end }
}

async function createApp(pool: Pool) {
  return NestFactory.createApplicationContext(
    {
      module: class PoolTestModule {},
      providers: [
        { provide: PG_POOL_TOKEN, useValue: pool },
        PostgresPoolLifecycle,
      ],
    },
    { logger: false },
  )
}

describe('PostgreSQL pool shutdown', () => {
  afterEach(() => {
    __setTestPostgresInstance(null, null)
  })

  it('ends the cached pool on app.close without replacing it', async () => {
    const { pool, end } = makePool()
    const cachedDb = { query: {} } as AppDatabase
    __setTestPostgresInstance(pool, cachedDb)
    const app = await createApp(pool)

    await app.close()

    expect(end).toHaveBeenCalledTimes(1)
    expect(await createPool()).toBe(pool)
    expect(db.query).toBe(cachedDb.query)

    await disposePool()

    expect(end).toHaveBeenCalledTimes(1)
    expect(() => db.query).toThrow('before initialization')
  })

  it('stops waiting for a pool that never drains', async () => {
    vi.useFakeTimers()
    try {
      const pool = {
        end: () => new Promise<void>(() => {}),
        totalCount: 1,
        idleCount: 0,
      } as unknown as Pool
      __setTestPostgresInstance(pool, {} as AppDatabase)

      const disposing = disposePool()
      await vi.advanceTimersByTimeAsync(5_000)

      await expect(disposing).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a shared pool open until the last app closes', async () => {
    const { pool, end } = makePool()
    const first = await createApp(pool)
    const second = await createApp(pool)

    await first.close()
    expect(end).not.toHaveBeenCalled()

    await second.close()
    expect(end).toHaveBeenCalledTimes(1)
  })

  it('does not clear a replacement pool when an older app closes', async () => {
    const old = makePool()
    const replacement = makePool()
    const replacementDb = { query: {} } as AppDatabase
    __setTestPostgresInstance(old.pool, {} as AppDatabase)
    const app = await createApp(old.pool)
    __setTestPostgresInstance(replacement.pool, replacementDb)

    await app.close()

    expect(old.end).toHaveBeenCalledTimes(1)
    expect(replacement.end).not.toHaveBeenCalled()
    expect(db.query).toBe(replacementDb.query)
  })
})
