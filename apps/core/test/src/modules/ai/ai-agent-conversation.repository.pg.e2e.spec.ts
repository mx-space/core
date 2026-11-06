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
    const conversation = await repo.create({
      sessionId: 'post:1',
      model: 'm',
      providerId: 'p',
    })
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

  it('creates a conversation with an empty transcript and no review state', async () => {
    const conversation = await repo.create({
      sessionId: 'post:2',
      model: 'm',
      providerId: 'p',
    })
    const detail = await repo.findDetail(conversation.id)
    expect(detail).toMatchObject({
      sessionId: 'post:2',
      model: 'm',
      providerId: 'p',
      title: null,
      transcript: { messages: [], known: {} },
      reviewState: null,
    })
    expect(detail).not.toHaveProperty('messages')
  })

  it('stores review state verbatim', async () => {
    const conversation = await repo.create({
      sessionId: 'post:3',
      model: 'm',
      providerId: 'p',
    })
    const state = {
      reviewState: { documentRevision: 2, batches: [{ id: 'b1', z: 1, a: 2 }] },
      anchors: [{ batchId: 'b1', toolCallId: 'call-1' }],
    }
    expect(await repo.saveReviewState(conversation.id, state)).toBe(true)
    const detail = await repo.findDetail(conversation.id)
    expect(JSON.stringify(detail!.reviewState)).toBe(JSON.stringify(state))
    expect(await repo.saveReviewState('1', state)).toBe(false)
  })
})
