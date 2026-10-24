import { describe, expect, it, vi } from 'vitest'

import worker from '../../../../telemetry/src/index'

describe('telemetry admission', () => {
  const payload = {
    instanceId: '00000000-0000-4000-8000-000000000001',
    version: '1.0.0',
    event: 'startup',
  }
  it('rejects oversized bodies before touching the database', async () => {
    const prepare = vi.fn()
    const response = await worker.fetch(
      new Request('https://telemetry.test/collect', {
        method: 'POST',
        body: JSON.stringify({ ...payload, padding: 'x'.repeat(4096) }),
      }),
      {
        DB: { prepare },
        COLLECT_LIMITER: { limit: async () => ({ success: true }) },
      } as any,
      {} as any,
    )
    expect(response.status).toBe(413)
    expect(prepare).not.toHaveBeenCalled()
  })
  it('rejects rate-limited callers before touching D1', async () => {
    const prepare = vi.fn()
    const response = await worker.fetch(
      new Request('https://telemetry.test/collect', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      {
        DB: { prepare },
        COLLECT_LIMITER: { limit: async () => ({ success: false }) },
      } as any,
      {} as any,
    )
    expect(response.status).toBe(429)
    expect(prepare).not.toHaveBeenCalled()
  })
})

it('deduplicates collection and refuses new rows after the daily budget (real SQLite)', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const { readFileSync } = await import('node:fs')
  const database = new DatabaseSync(':memory:')
  database.exec(
    readFileSync(
      new URL('../../../../telemetry/schema.sql', import.meta.url),
      'utf8',
    ),
  )
  const env = {
    COLLECT_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare: (sql: string) => ({
        bind: (...values: string[]) => ({
          run: async () => ({
            meta: {
              changes: Number(database.prepare(sql).run(...values).changes),
            },
          }),
        }),
      }),
    },
  }
  const collect = (id: string) =>
    worker.fetch(
      new Request('https://telemetry.test/collect', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: id,
          version: '1.0.0',
          event: 'startup',
        }),
      }),
      env as any,
      {} as any,
    )
  try {
    expect((await collect('00000000-0000-4000-8000-000000000001')).status).toBe(
      200,
    )
    expect((await collect('00000000-0000-4000-8000-000000000001')).status).toBe(
      429,
    )
    database.exec(
      `WITH RECURSIVE rows(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM rows WHERE n < 9999) INSERT INTO telemetry(instance_id,version,event) SELECT 'test-' || n,'1.0.0','startup' FROM rows`,
    )
    expect((await collect('00000000-0000-4000-8000-000000000002')).status).toBe(
      429,
    )
    expect(
      database.prepare('SELECT count(*) AS count FROM telemetry').get()?.count,
    ).toBe(10000)
  } finally {
    database.close()
  }
})
