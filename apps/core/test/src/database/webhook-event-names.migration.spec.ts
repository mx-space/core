import fs from 'node:fs'
import path from 'node:path'

import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import { describe, expect, it } from 'vitest'

const migrationSql = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../src/database/migrations/0034_webhook_event_names.sql',
  ),
  'utf8',
)

describe('webhook event name migration', () => {
  it('restores legacy subscriptions without changing unrelated events', async () => {
    const context = await createPgTestDatabase('mx_webhook_event_names')
    try {
      await context.pool.query(
        `INSERT INTO webhooks (id, payload_url, events, secret, scope)
         VALUES (1, 'https://example.com/webhook', $1, 'secret', 7)`,
        [['POST_CREATE', 'all', 'custom.event', 'companion.presence.changed']],
      )

      await context.pool.query(migrationSql)
      await context.pool.query(migrationSql)

      const result = await context.pool.query<{ events: string[] }>(
        "SELECT events FROM webhooks WHERE id = '1'",
      )
      expect(result.rows[0]?.events).toEqual([
        'post.create',
        'all',
        'custom.event',
        'companion_presence.changed',
      ])
    } finally {
      await context.close()
    }
  }, 120_000)
})
