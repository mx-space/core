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
import { AppException } from '~/common/errors/exception.types'
import * as schema from '~/database/schema'
import { corpusEmbeddings } from '~/database/schema'
import { AiEmbeddingsRepository } from '~/modules/ai/ai-embeddings/ai-embeddings.repository'
import { AiEmbeddingsService } from '~/modules/ai/ai-embeddings/ai-embeddings.service'
import { runCorpusBackfill } from '~/modules/ai/ai-embeddings/tasks/corpus-backfill.driver'
import { SnowflakeService } from '~/shared/id/snowflake.service'

type Drizzle = NodePgDatabase<typeof schema>

const wireService = (
  db: Drizzle,
  opts: {
    configured?: boolean
    sources?: Record<string, { type: string; document: { text: string } }>
  } = {},
) => {
  const repository = new AiEmbeddingsRepository(
    db as any,
    new SnowflakeService(),
  )
  const sources = opts.sources ?? {}
  const databaseService = {
    findGlobalById: vi.fn(async (id: string) => sources[id] ?? null),
  }
  const runtime = createMockEmbeddingRuntime()
  const aiService = {
    hasFeatureModel: vi.fn(async () => opts.configured ?? true),
    getEmbeddingModel: vi.fn(async () => runtime),
  }
  const configService = {
    get: vi.fn(async () => ({
      aiEmbedding: {
        chunkMaxTokens: 80,
        chunkOverlapTokens: 0,
        backfillBatchSize: 50,
        defaultMinSimilarity: 0.6,
        defaultTopK: 5,
      },
    })),
  }
  const service = new AiEmbeddingsService(
    repository,
    configService as any,
    aiService as any,
    databaseService as any,
    db as any,
  )
  return { service, repository, runtime, databaseService, aiService }
}

describe('AiEmbeddingsService integration (pg testcontainer)', () => {
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
    await pool.query('DELETE FROM corpus_embeddings')
  })

  it('upserts chunks for a new note', async () => {
    const noteId = '7000000000000000001'
    const { service } = wireService(db, {
      sources: {
        [noteId]: {
          type: 'note',
          document: { text: 'first paragraph.\n\nsecond paragraph.' },
        },
      },
    })

    const res = await service.syncSource('note', noteId, 'upsert')
    expect(res.embedded).toBeGreaterThan(0)

    const rows = await db.select().from(corpusEmbeddings)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].sourceType).toBe('note')
    expect(rows[0].embeddingModel).toBe('mock-embedding-model')
    expect(rows[0].dim).toBe(8)
  })

  it('is a no-op when content unchanged', async () => {
    const noteId = '7000000000000000002'
    const sources = {
      [noteId]: {
        type: 'note',
        document: { text: 'alpha\n\nbeta\n\ngamma' },
      },
    }
    const { service } = wireService(db, { sources })

    await service.syncSource('note', noteId, 'upsert')
    const firstRows = await db.select().from(corpusEmbeddings)

    const second = await service.syncSource('note', noteId, 'upsert')
    expect(second.embedded).toBe(0)
    const secondRows = await db.select().from(corpusEmbeddings)
    expect(secondRows.map((r) => r.id).sort()).toEqual(
      firstRows.map((r) => r.id).sort(),
    )
  })

  it('re-embeds only chunks whose content hash changed', async () => {
    const noteId = '7000000000000000003'
    const initial = {
      [noteId]: {
        type: 'note',
        document: {
          text: 'paragraph A original\n\nparagraph B original\n\nparagraph C original',
        },
      },
    }
    const wired = wireService(db, { sources: initial })
    await wired.service.syncSource('note', noteId, 'upsert')

    const before = await db.select().from(corpusEmbeddings)
    expect(before.length).toBeGreaterThanOrEqual(1)

    const updated = {
      [noteId]: {
        type: 'note',
        document: {
          text: 'paragraph A original\n\nparagraph B CHANGED\n\nparagraph C original',
        },
      },
    }
    const wired2 = wireService(db, { sources: updated })
    const res2 = await wired2.service.syncSource('note', noteId, 'upsert')
    expect(res2.embedded).toBeGreaterThan(0)
    expect(res2.embedded! < before.length + 1).toBe(true)
  })

  it('removes all rows on delete', async () => {
    const noteId = '7000000000000000004'
    const { service } = wireService(db, {
      sources: {
        [noteId]: { type: 'note', document: { text: 'hello world' } },
      },
    })
    await service.syncSource('note', noteId, 'upsert')

    const res = await service.syncSource('note', noteId, 'delete')
    expect(res.deleted).toBeGreaterThan(0)
    const rows = await db.select().from(corpusEmbeddings)
    expect(rows.length).toBe(0)
  })

  it('search returns rows ordered and threshold-filtered', async () => {
    const ids = [
      '7000000000000000010',
      '7000000000000000011',
      '7000000000000000012',
    ]
    const texts = ['cats love fish', 'dogs love bones', 'parrots mimic words']
    const sources: Record<string, any> = {}
    ids.forEach((id, i) => {
      sources[id] = { type: 'note', document: { text: texts[i] } }
    })
    const { service } = wireService(db, { sources })
    for (const id of ids) {
      await service.syncSource('note', id, 'upsert')
    }

    const results = await service.search('cats love fish', {
      topK: 3,
      minSimilarity: 0.5,
    })
    expect(results.length).toBeGreaterThan(0)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].distance).toBeLessThanOrEqual(results[i].distance)
    }
    for (const r of results) {
      expect(r.similarity).toBeGreaterThanOrEqual(0.5)
      expect(r.similarity).toBeCloseTo(1 - r.distance, 5)
    }
    expect(results[0].content).toContain('cats')
  })

  it('graceful no-op when embedding model unconfigured', async () => {
    const noteId = '7000000000000000020'
    const { service } = wireService(db, {
      configured: false,
      sources: {
        [noteId]: { type: 'note', document: { text: 'hello' } },
      },
    })
    const res = await service.syncSource('note', noteId, 'upsert')
    expect(res).toEqual({})
    const rows = await db.select().from(corpusEmbeddings)
    expect(rows).toHaveLength(0)

    await expect(service.search('hello')).rejects.toBeInstanceOf(AppException)
  })

  it('backfill driver runs idempotently with no duplicates', async () => {
    const noteIds = ['7000000000000000030', '7000000000000000031']
    const sources: Record<string, any> = {}
    for (const id of noteIds) {
      sources[id] = {
        type: 'note',
        document: { text: `unique text for ${id}` },
      }
    }
    const { service } = wireService(db, { sources })

    for (const id of noteIds) {
      await service.syncSource('note', id, 'upsert')
    }
    const before = (await db.select().from(corpusEmbeddings)).length

    const summary = await runCorpusBackfill(service, db as any, {
      sourceTypes: [],
    })
    expect(summary.configured).toBe(true)

    const after = (await db.select().from(corpusEmbeddings)).length
    expect(after).toBe(before)
  })
})
