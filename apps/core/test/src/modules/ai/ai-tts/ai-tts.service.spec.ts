import { createPgRepositoryMock } from 'test/helper/pg-repository-mock'
import { describe, expect, it, vi } from 'vitest'

import type { AiTtsRepository } from '~/modules/ai/ai-tts/ai-tts.repository'
import { AiTtsService } from '~/modules/ai/ai-tts/ai-tts.service'

function createHarness() {
  const configService = { get: vi.fn(async () => ({})) }
  const fileService = { deleteObject: vi.fn(async () => {}) }
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

  return { fileService, repository, service }
}

describe('AiTtsService.deleteById', () => {
  it('removes the narration row and its stored audio objects', async () => {
    const { fileService, repository, service } = createHarness()
    repository.deleteById.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
      { storageBackend: 'local', storageKey: 'tts/1/zh/b.mp3' },
    ] as any)

    await service.deleteById('tts-1')

    expect(repository.deleteById).toHaveBeenCalledWith('tts-1')
    expect(fileService.deleteObject).toHaveBeenCalledWith('s3', 'k/a')
    expect(fileService.deleteObject).toHaveBeenCalledWith(
      'local',
      'tts/1/zh/b.mp3',
    )
  })

  it('is a no-op when the id does not match any narration', async () => {
    const { fileService, repository, service } = createHarness()
    repository.deleteById.mockResolvedValue([])

    await expect(service.deleteById('missing')).resolves.toBeUndefined()
    expect(fileService.deleteObject).not.toHaveBeenCalled()
  })

  it('survives a failing object deletion', async () => {
    const { fileService, repository, service } = createHarness()
    repository.deleteById.mockResolvedValue([
      { storageBackend: 's3', storageKey: 'k/a' },
    ] as any)
    fileService.deleteObject.mockRejectedValue(new Error('network'))

    await expect(service.deleteById('tts-1')).resolves.toBeUndefined()
  })
})
