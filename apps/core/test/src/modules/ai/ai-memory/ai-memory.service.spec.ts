import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPgRepositoryMock } from '@/helper/pg-repository-mock'
import { createMockEmbeddingRuntime } from '@/mock/processors/ai-embedding.mock'
import type { AiMemoryRepository } from '~/modules/ai/ai-memory/ai-memory.repository'
import { AiMemoryService } from '~/modules/ai/ai-memory/ai-memory.service'
import type {
  AiMemory,
  RecallScoredMemory,
} from '~/modules/ai/ai-memory/ai-memory.types'

const baseMemory = (overrides: Partial<AiMemory> = {}): AiMemory => ({
  id: '7000000000000000010' as any,
  scope: 'global',
  type: 'fact',
  content: 'I prefer brevity',
  confidence: 1,
  salience: 1,
  source: { kind: 'manual' },
  embedding: null,
  embeddingModel: null,
  dim: null,
  firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
  lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
  expiresAt: null,
  supersedesId: null,
  status: 'active',
  metadata: {},
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: null,
  ...overrides,
})

const createService = () => {
  const repository = createPgRepositoryMock<AiMemoryRepository>()
  const aiTaskService = {
    crud: {
      createTask: vi.fn().mockResolvedValue({ taskId: 't1', created: true }),
    },
  }
  const aiService = {
    getEmbeddingModel: vi.fn(),
  }
  const configService = {
    get: vi.fn().mockResolvedValue({
      aiMemory: { recallTopK: 5, recallMinSimilarity: 0.7 },
    }),
  }
  const service = new AiMemoryService(
    repository as any,
    aiTaskService as any,
    aiService as any,
    configService as any,
  )
  return { repository, aiTaskService, aiService, configService, service }
}

describe('AiMemoryService.recall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns salience-ordered active memories when no query supplied', async () => {
    const { repository, service } = createService()
    const rows = [
      baseMemory({ id: '1' as any, salience: 3 }),
      baseMemory({ id: '2' as any, salience: 5 }),
    ]
    repository.listActiveByScope.mockResolvedValue(rows)

    const result = await service.recall({ scope: 'global' })

    expect(repository.listActiveByScope).toHaveBeenCalledWith(['global'], 5)
    expect(result.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('returns [] when query is set but embedding model unavailable', async () => {
    const { aiService, repository, service } = createService()
    aiService.getEmbeddingModel.mockRejectedValue(new Error('not configured'))

    const result = await service.recall({ scope: 'global', query: 'foo' })

    expect(result).toEqual([])
    expect(repository.vectorSearch).not.toHaveBeenCalled()
  })

  it('applies similarity threshold and re-ranks by similarity * salience * confidence', async () => {
    const { aiService, repository, service } = createService()
    aiService.getEmbeddingModel.mockResolvedValue(createMockEmbeddingRuntime())

    const candidates: RecallScoredMemory[] = [
      {
        ...baseMemory({ id: 'a' as any, salience: 1, confidence: 1 }),
        similarity: 0.95,
      },
      {
        ...baseMemory({ id: 'b' as any, salience: 5, confidence: 1 }),
        similarity: 0.8,
      },
      {
        ...baseMemory({ id: 'c' as any, salience: 1, confidence: 1 }),
        similarity: 0.4,
      },
    ]
    repository.vectorSearch.mockResolvedValue(candidates)

    const result = await service.recall({
      scope: ['global', 'persona:inner-self'],
      query: 'brevity',
      topK: 2,
      minSimilarity: 0.7,
    })

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('b')
    expect(result[1].id).toBe('a')
    expect(repository.vectorSearch).toHaveBeenCalledWith(
      ['global', 'persona:inner-self'],
      expect.any(Array),
      expect.any(String),
      4,
    )
  })

  it('filters out below-threshold candidates', async () => {
    const { aiService, repository, service } = createService()
    aiService.getEmbeddingModel.mockResolvedValue(createMockEmbeddingRuntime())
    repository.vectorSearch.mockResolvedValue([
      { ...baseMemory({ id: 'x' as any }), similarity: 0.5 },
    ])

    const result = await service.recall({
      scope: 'global',
      query: 'q',
      minSimilarity: 0.7,
    })

    expect(result).toEqual([])
  })
})

describe('AiMemoryService.create / update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists then enqueues MEMORY_EMBED on create', async () => {
    const { repository, aiTaskService, service } = createService()
    const row = baseMemory({ id: '9001' as any })
    repository.create.mockResolvedValue(row)

    const created = await service.create(
      {
        scope: 'global',
        type: 'fact',
        content: 'x',
        confidence: 1,
        salience: 1,
      },
      'actor-1',
    )

    expect(created.id).toBe('9001')
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { kind: 'manual', authorId: 'actor-1' },
      }),
    )
    expect(aiTaskService.crud.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ai:memory:embed',
        payload: { memoryId: '9001' },
      }),
    )
  })

  it('does not enqueue embed when update omits content', async () => {
    const { repository, aiTaskService, service } = createService()
    const row = baseMemory({ id: '9002' as any, content: 'unchanged' })
    repository.findById.mockResolvedValue(row)
    repository.update.mockResolvedValue(row)

    await service.update('9002', { salience: 5 }, 'actor')

    expect(aiTaskService.crud.createTask).not.toHaveBeenCalled()
  })

  it('enqueues embed when update changes content', async () => {
    const { repository, aiTaskService, service } = createService()
    const existing = baseMemory({ id: '9003' as any, content: 'old' })
    const updated = baseMemory({ id: '9003' as any, content: 'new' })
    repository.findById.mockResolvedValue(existing)
    repository.update.mockResolvedValue(updated)

    await service.update('9003', { content: 'new' }, 'actor')

    expect(aiTaskService.crud.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { memoryId: '9003' } }),
    )
  })
})

describe('AiMemoryService.handleEmbedTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips when memory is archived', async () => {
    const { repository, aiService, service } = createService()
    repository.findById.mockResolvedValue(
      baseMemory({ id: '9004' as any, status: 'archived' }),
    )
    aiService.getEmbeddingModel.mockResolvedValue(createMockEmbeddingRuntime())

    await service.handleEmbedTask('9004')

    expect(repository.updateEmbedding).not.toHaveBeenCalled()
  })

  it('no-ops when embedding model unavailable', async () => {
    const { repository, aiService, service } = createService()
    repository.findById.mockResolvedValue(baseMemory({ id: '9005' as any }))
    aiService.getEmbeddingModel.mockRejectedValue(new Error('unset'))

    await service.handleEmbedTask('9005')

    expect(repository.updateEmbedding).not.toHaveBeenCalled()
  })

  it('writes vector when runtime returns embedding', async () => {
    const { repository, aiService, service } = createService()
    repository.findById.mockResolvedValue(baseMemory({ id: '9006' as any }))
    aiService.getEmbeddingModel.mockResolvedValue(createMockEmbeddingRuntime())

    await service.handleEmbedTask('9006')

    expect(repository.updateEmbedding).toHaveBeenCalledWith(
      '9006',
      expect.any(Array),
      'mock-embedding-model',
    )
  })
})

describe('AiMemoryService.getKpi', () => {
  it('aggregates total / active / archived counts', async () => {
    const { repository, service } = createService()
    repository.countByStatus.mockResolvedValue({
      active: 3,
      archived: 2,
      superseded: 1,
      pending_review: 0,
    })

    const kpi = await service.getKpi()
    expect(kpi).toEqual({ total: 6, active: 3, archived: 2 })
  })
})
