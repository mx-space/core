import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { AiAgentConversationRepository } from '~/modules/ai/ai-agent/ai-agent-conversation.repository'
import type { AppDatabase } from '~/processors/database/postgres.provider'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('ai agent conversation transcript (real PG)', () => {
  let pool: Pool
  let database: Awaited<ReturnType<typeof createIsolatedPgDatabase>>
  let repo: AiAgentConversationRepository

  beforeAll(async () => {
    database = await createIsolatedPgDatabase()
    pool = new Pool({ connectionString: database.getConnectionUri() })
    repo = new AiAgentConversationRepository(
      drizzle(pool) as unknown as AppDatabase,
      new SnowflakeService(),
    )
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await database?.drop()
  })

  it('keeps tool argument key order so a replayed history matches the cached prompt prefix', async () => {
    const conversation = await repo.create({ sessionId: 'post:1' })
    const args = { type: 'note', id: '133259626689347643', limit: 1500 }
    await repo.saveTranscript(conversation.id, {
      known: {},
      messages: [
        {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              id: 'c1',
              name: 'read_article',
              arguments: args,
            },
          ],
        },
      ],
    })

    const stored = await repo.findWithTranscript(conversation.id)
    const messages = stored!.transcript!.messages as Array<{
      content: Array<{ arguments: unknown }>
    }>

    expect(JSON.stringify(messages[0].content[0].arguments)).toBe(
      JSON.stringify(args),
    )
  })
})
