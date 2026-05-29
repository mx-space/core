import { describe, expect, it, vi } from 'vitest'

import { createMockEmbeddingRuntime } from '@/mock/processors/ai-embedding.mock'
import { AppException } from '~/common/errors/exception.types'
import { AiEmbeddingsService } from '~/modules/ai/ai-embeddings/ai-embeddings.service'

const createService = (overrides: { configured?: boolean } = {}) => {
  const repository = {
    findBySource: vi.fn().mockResolvedValue([]),
    deleteBySource: vi.fn().mockResolvedValue(0),
    deleteByIndices: vi.fn().mockResolvedValue(0),
    upsertChunks: vi.fn().mockResolvedValue(0),
    searchByVector: vi.fn(),
    stats: vi.fn(),
  }
  const configService = {
    get: vi.fn().mockResolvedValue({ aiEmbedding: {} }),
  }
  const runtime = createMockEmbeddingRuntime()
  const aiService = {
    hasFeatureModel: vi.fn().mockResolvedValue(overrides.configured ?? true),
    getEmbeddingModel: vi.fn().mockResolvedValue(runtime),
  }
  const databaseService = {
    findGlobalById: vi.fn(),
  }
  const db = {} as never
  const service = new AiEmbeddingsService(
    repository as any,
    configService as any,
    aiService as any,
    databaseService as any,
    db,
  )
  return {
    repository,
    configService,
    aiService,
    databaseService,
    runtime,
    service,
  }
}

describe('AiEmbeddingsService.search', () => {
  it('annotates similarity as 1 - distance and filters by threshold', async () => {
    const { repository, service } = createService()
    repository.searchByVector.mockResolvedValue([
      {
        sourceType: 'note',
        sourceId: 'note-1',
        chunkIndex: 0,
        content: 'a',
        distance: 0.1,
        similarity: 0.9,
      },
      {
        sourceType: 'note',
        sourceId: 'note-2',
        chunkIndex: 0,
        content: 'b',
        distance: 0.5,
        similarity: 0.5,
      },
    ])

    const out = await service.search('hello', { minSimilarity: 0.7 })
    expect(out).toHaveLength(1)
    expect(out[0].sourceId).toBe('note-1')
    expect(out[0].similarity).toBeCloseTo(0.9)
  })

  it('throws AI_EMBEDDING_MODEL_NOT_CONFIGURED when embedding model missing', async () => {
    const { service } = createService({ configured: false })
    await expect(service.search('hello')).rejects.toBeInstanceOf(AppException)
  })

  it('returns empty array on blank query', async () => {
    const { service } = createService()
    expect(await service.search('   ')).toEqual([])
  })
})

describe('AiEmbeddingsService.syncSource', () => {
  it('deletes when op === delete regardless of model configuration', async () => {
    const { repository, service } = createService({ configured: false })
    repository.deleteBySource.mockResolvedValue(3)
    const res = await service.syncSource('note', 'note-1', 'delete')
    expect(res.deleted).toBe(3)
    expect(repository.deleteBySource).toHaveBeenCalledWith('note', 'note-1')
  })

  it('no-ops gracefully when embedding model unconfigured for upsert', async () => {
    const { repository, service, databaseService } = createService({
      configured: false,
    })
    const res = await service.syncSource('note', 'note-1', 'upsert')
    expect(res).toEqual({})
    expect(databaseService.findGlobalById).not.toHaveBeenCalled()
    expect(repository.upsertChunks).not.toHaveBeenCalled()
  })

  it('skips when source not found', async () => {
    const { service, databaseService } = createService()
    databaseService.findGlobalById.mockResolvedValue(null)
    const res = await service.syncSource('note', 'note-1', 'upsert')
    expect(res).toEqual({})
  })

  it('skips re-embedding when content hash unchanged', async () => {
    const { service, databaseService, repository, runtime } = createService()
    databaseService.findGlobalById.mockResolvedValue({
      type: 'note',
      document: { text: 'paragraph alpha.\n\nparagraph beta.' },
    })

    const embedSpy = vi.spyOn(runtime, 'embedBatch')

    await service.syncSource('note', 'note-1', 'upsert')
    expect(embedSpy).toHaveBeenCalled()
    const upsertedInputs = repository.upsertChunks.mock.calls[0]?.[0] ?? []
    expect(upsertedInputs.length).toBeGreaterThan(0)

    repository.findBySource.mockResolvedValue(
      upsertedInputs.map((u: any) => ({
        id: '1',
        sourceType: u.sourceType,
        sourceId: u.sourceId,
        chunkIndex: u.chunkIndex,
        content: u.content,
        contentHash: u.contentHash,
        embedding: u.embedding,
        embeddingModel: u.embeddingModel,
        dim: u.dim,
        createdAt: new Date(),
      })),
    )
    embedSpy.mockClear()
    repository.upsertChunks.mockClear()

    const second = await service.syncSource('note', 'note-1', 'upsert')
    expect(embedSpy).not.toHaveBeenCalled()
    expect(second.embedded).toBe(0)
  })
})
