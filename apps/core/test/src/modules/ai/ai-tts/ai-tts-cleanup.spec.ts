import { createPgRepositoryMock } from 'test/helper/pg-repository-mock'
import { describe, expect, it, vi } from 'vitest'

import { createAiGenerationMetricsMock } from '@/helper/ai-generation-metrics-mock'
import type { AiTtsRepository } from '~/modules/ai/ai-tts/ai-tts.repository'
import { AiTtsService } from '~/modules/ai/ai-tts/ai-tts.service'

// `@nestjs/event-emitter`'s `OnEvent.KEY` static property does not survive
// this project's ESM/CJS interop in tests; the metadata key itself is a
// stable literal (`extend-metadata.util.js`), so we assert against that.
const EVENT_LISTENER_METADATA = 'EVENT_LISTENER_METADATA'

function createHarness() {
  const configService = { get: vi.fn(async () => ({})) }
  const fileService = {
    deleteObject: vi.fn(async () => {}),
  }
  const taskProcessor = { registerHandler: vi.fn() }
  const repository = createPgRepositoryMock<AiTtsRepository>()
  const databaseService = { findGlobalById: vi.fn() }
  const lexicalService = { extractRootBlockNodes: vi.fn() }
  const translationRepository = { findByRefAndLang: vi.fn() }
  const redisService = { getClient: vi.fn() }
  const generationMetrics = createAiGenerationMetricsMock()

  const service = new AiTtsService(
    configService as any,
    fileService as any,
    taskProcessor as any,
    repository as any,
    databaseService as any,
    lexicalService as any,
    translationRepository as any,
    redisService as any,
    generationMetrics as any,
  )

  return { configService, fileService, generationMetrics, repository, service }
}

describe('AiTtsService.handleArticleDeleted', () => {
  it('removes rows and their objects when an article is deleted', async () => {
    const { fileService, generationMetrics, repository, service } =
      createHarness()
    repository.findAllByRef.mockResolvedValue([
      { id: 'tts-1' },
      { id: 'tts-2' },
    ] as any)
    repository.deleteByRefId.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
      { storageBackend: 'local', storageKey: 'tts/1/zh/b.mp3' },
    ] as any)

    await service.handleArticleDeleted('1')

    expect(repository.deleteByRefId).toHaveBeenCalledWith('1')
    expect(fileService.deleteObject).toHaveBeenCalledWith('s3', 'k/a')
    expect(fileService.deleteObject).toHaveBeenCalledWith(
      'local',
      'tts/1/zh/b.mp3',
    )
    expect(generationMetrics.deleteByResource).toHaveBeenCalledWith(
      'tts',
      'tts-1',
    )
    expect(generationMetrics.deleteByResource).toHaveBeenCalledWith(
      'tts',
      'tts-2',
    )
  })

  it('survives an object deletion failure', async () => {
    const { fileService, generationMetrics, repository, service } =
      createHarness()
    repository.findAllByRef.mockResolvedValue([{ id: 'tts-1' }] as any)
    repository.deleteByRefId.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
    ] as any)
    fileService.deleteObject.mockRejectedValue(new Error('network'))

    await expect(service.handleArticleDeleted('1')).resolves.toBeUndefined()
    expect(generationMetrics.deleteByResource).toHaveBeenCalledWith(
      'tts',
      'tts-1',
    )
  })

  it('is wired to the post/note/page delete events', () => {
    const listeners: Array<{ event: string }> = Reflect.getMetadata(
      EVENT_LISTENER_METADATA,
      AiTtsService.prototype.handleDeleteArticle,
    )
    expect(listeners.map((listener) => listener.event)).toEqual(
      expect.arrayContaining(['POST_DELETE', 'NOTE_DELETE', 'PAGE_DELETE']),
    )
  })
})
