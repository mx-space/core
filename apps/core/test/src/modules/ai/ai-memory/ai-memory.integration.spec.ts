import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { startPgTestContainer } from '@/helper/pg-testcontainer'
import { createMockEmbeddingRuntime } from '@/mock/processors/ai-embedding.mock'
import * as schema from '~/database/schema'
import { aiMemories } from '~/database/schema'
import { AiMemoryRepository } from '~/modules/ai/ai-memory/ai-memory.repository'
import { AiMemoryService } from '~/modules/ai/ai-memory/ai-memory.service'
import { SnowflakeService } from '~/shared/id/snowflake.service'

type Drizzle = NodePgDatabase<typeof schema>

const createEnqueueSpy = () => {
  const enqueued: string[] = []
  return {
    enqueued,
    crud: {
      createTask: vi.fn(async (input: { payload: { memoryId: string } }) => {
        enqueued.push(input.payload.memoryId)
        return { taskId: 'task-' + input.payload.memoryId, created: true }
      }),
    },
  }
}

const wireService = (
  db: Drizzle,
  opts: {
    embeddingRuntime?: ReturnType<typeof createMockEmbeddingRuntime> | null
  } = {},
) => {
  const repository = new AiMemoryRepository(db as any, new SnowflakeService())
  const taskService = createEnqueueSpy()
  const aiService = {
    async getEmbeddingModel() {
      if (opts.embeddingRuntime === null) {
        throw new Error('no embedding model configured')
      }
      return opts.embeddingRuntime ?? createMockEmbeddingRuntime()
    },
  }
  const configService = {
    async get() {
      return {
        aiMemory: { recallTopK: 5, recallMinSimilarity: 0.7 },
      }
    },
  }
  const service = new AiMemoryService(
    repository,
    taskService as any,
    aiService as any,
    configService as any,
  )
  return { service, repository, taskService }
}

describe('AiMemoryService integration (pg testcontainer)', () => {
  let pool: Pool
  let db: Drizzle

  beforeAll(async () => {
    const container = await startPgTestContainer()
    pool = new Pool({ connectionString: container.getConnectionUri(), max: 4 })
    db = drizzle(pool, { schema, casing: 'snake_case' })
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector')
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM ai_memories')
  })

  it('creates memory with embedding=null and enqueues MEMORY_EMBED', async () => {
    const { service, taskService } = wireService(db)
    const created = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'Brevity matters',
        confidence: 1,
        salience: 1,
      },
      'actor-1',
    )

    expect(created.embedding).toBeNull()
    expect(created.source).toEqual({ kind: 'manual', authorId: 'actor-1' })
    expect(taskService.enqueued).toEqual([created.id])
  })

  it('embed task populates embedding column', async () => {
    const { service } = wireService(db)
    const created = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'I value brevity',
        confidence: 1,
        salience: 1,
      },
      'actor-2',
    )

    await service.handleEmbedTask(created.id)

    const rows = await db.select().from(aiMemories)
    const row = rows.find((r) => r.id === created.id)!
    expect(row.embedding).not.toBeNull()
    expect(row.embeddingModel).toBe('mock-embedding-model')
    expect(row.dim).toBe(8)
  })

  it('re-enqueues embed on content change but not on metadata-only update', async () => {
    const { service, taskService } = wireService(db)
    const row = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'original',
        confidence: 1,
        salience: 1,
      },
      'actor',
    )
    taskService.enqueued.length = 0

    await service.update(row.id, { salience: 2 }, 'actor')
    expect(taskService.enqueued).toEqual([])

    await service.update(row.id, { content: 'changed' }, 'actor')
    expect(taskService.enqueued).toEqual([row.id])
  })

  it('archive sets status and excludes from recall', async () => {
    const { service } = wireService(db)
    const row = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'archived later',
        confidence: 1,
        salience: 1,
      },
      'actor',
    )

    await service.archive(row.id)

    const reloaded = (await db.select().from(aiMemories)).find(
      (r) => r.id === row.id,
    )!
    expect(reloaded.status).toBe('archived')

    const recalled = await service.recall({ scope: 'global' })
    expect(recalled.find((m) => m.id === row.id)).toBeUndefined()
  })

  it('recall (no query) skips expired memories', async () => {
    const { service } = wireService(db)
    const active = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'active mem',
        confidence: 1,
        salience: 1,
      },
      'actor',
    )
    const expired = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'expired mem',
        confidence: 1,
        salience: 5,
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
      'actor',
    )

    const recalled = await service.recall({ scope: 'global' })

    const ids = recalled.map((r) => r.id)
    expect(ids).toContain(active.id)
    expect(ids).not.toContain(expired.id)
  })

  it('recall returns [] when query set but embedding model unconfigured', async () => {
    const { service } = wireService(db, { embeddingRuntime: null })
    await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'hello world',
        confidence: 1,
        salience: 1,
      },
      'actor',
    )

    const result = await service.recall({ scope: 'global', query: 'world' })
    expect(result).toEqual([])
  })

  it('recall query path retrieves vector matches ordered by score', async () => {
    const { service } = wireService(db)
    const created: string[] = []
    for (const content of [
      'cats love fish',
      'dogs love bones',
      'parrots mimic words',
    ]) {
      const row = await service.create(
        { scope: 'global', type: 'fact', content, confidence: 1, salience: 1 },
        'actor',
      )
      created.push(row.id)
      await service.handleEmbedTask(row.id)
    }

    const recalled = await service.recall({
      scope: 'global',
      query: 'cats love fish',
      topK: 3,
      minSimilarity: 0.5,
    })
    expect(recalled.length).toBeGreaterThan(0)
    expect(recalled[0].content).toBe('cats love fish')
  })

  it('getKpi reports total / active / archived counts', async () => {
    const { service } = wireService(db)
    const a = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'a',
        confidence: 1,
        salience: 1,
      },
      'actor',
    )
    await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'b',
        confidence: 1,
        salience: 1,
      },
      'actor',
    )
    await service.archive(a.id)

    const kpi = await service.getKpi()
    expect(kpi.total).toBe(2)
    expect(kpi.active).toBe(1)
    expect(kpi.archived).toBe(1)
  })
})
