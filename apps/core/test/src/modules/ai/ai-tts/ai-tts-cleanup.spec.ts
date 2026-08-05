import { createPgRepositoryMock } from 'test/helper/pg-repository-mock'
import { describe, expect, it, vi } from 'vitest'

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
    listObjectsUnderPrefix: vi.fn(async () => []),
  }
  const taskProcessor = { registerHandler: vi.fn() }
  const repository = createPgRepositoryMock<AiTtsRepository>()
  const databaseService = { findGlobalById: vi.fn() }
  const lexicalService = { extractRootBlockNodes: vi.fn() }
  const translationRepository = { findByRefAndLang: vi.fn() }
  const redisService = { getClient: vi.fn() }

  const service = new AiTtsService(
    configService as any,
    fileService as any,
    taskProcessor as any,
    repository as any,
    databaseService as any,
    lexicalService as any,
    translationRepository as any,
    redisService as any,
  )

  return { configService, fileService, repository, service }
}

describe('AiTtsService.handleArticleDeleted', () => {
  it('removes rows and their objects when an article is deleted', async () => {
    const { fileService, repository, service } = createHarness()
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
  })

  it('survives an object deletion failure', async () => {
    const { fileService, repository, service } = createHarness()
    repository.deleteByRefId.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
    ] as any)
    fileService.deleteObject.mockRejectedValue(new Error('network'))

    await expect(service.handleArticleDeleted('1')).resolves.toBeUndefined()
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

describe('AiTtsService.reconcileOrphans', () => {
  it('is a no-op when the storage backend cannot be listed', async () => {
    const { fileService, repository, service } = createHarness()
    fileService.listObjectsUnderPrefix.mockResolvedValue(null)

    await expect(service.reconcileOrphans()).resolves.toEqual({ deleted: 0 })
    expect(repository.findAllStorageKeys).not.toHaveBeenCalled()
  })

  it('deletes objects with no row that are older than the age floor', async () => {
    const { fileService, repository, service } = createHarness()
    const now = Date.now()
    fileService.listObjectsUnderPrefix.mockResolvedValue([
      {
        storageBackend: 's3',
        storageKey: 'tts/1/zh/known.mp3',
        lastModified: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        storageBackend: 's3',
        storageKey: 'tts/1/zh/old-orphan.mp3',
        lastModified: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        storageBackend: 'local',
        storageKey: 'tts/1/zh/fresh-orphan.mp3',
        lastModified: new Date(now - 30 * 1000),
      },
    ] as any)
    repository.findAllStorageKeys.mockResolvedValue(
      new Set(['tts/1/zh/known.mp3']),
    )

    const result = await service.reconcileOrphans()

    expect(result).toEqual({ deleted: 1 })
    expect(fileService.deleteObject).toHaveBeenCalledTimes(1)
    expect(fileService.deleteObject).toHaveBeenCalledWith(
      's3',
      'tts/1/zh/old-orphan.mp3',
    )
  })

  it('logs and continues past a delete failure', async () => {
    const { fileService, repository, service } = createHarness()
    const now = Date.now()
    fileService.listObjectsUnderPrefix.mockResolvedValue([
      {
        storageBackend: 's3',
        storageKey: 'tts/1/zh/a.mp3',
        lastModified: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        storageBackend: 's3',
        storageKey: 'tts/1/zh/b.mp3',
        lastModified: new Date(now - 2 * 60 * 60 * 1000),
      },
    ] as any)
    repository.findAllStorageKeys.mockResolvedValue(new Set())
    fileService.deleteObject.mockRejectedValueOnce(new Error('network'))

    const result = await service.reconcileOrphans()

    expect(result).toEqual({ deleted: 1 })
  })
})
