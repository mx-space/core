import { createPgRepositoryMock } from 'test/helper/pg-repository-mock'
import { describe, expect, it, vi } from 'vitest'

import type { AiTtsRepository } from '~/modules/ai/ai-tts/ai-tts.repository'
import { AiTtsQueryService } from '~/modules/ai/ai-tts/ai-tts-query.service'

function createHarness() {
  const repository = createPgRepositoryMock<AiTtsRepository>()
  const databaseService = { findGlobalById: vi.fn() }
  const service = new AiTtsQueryService(
    repository as any,
    databaseService as any,
    { isPremiumLocked: vi.fn(async () => false) } as any,
    { checkPasswordToAccess: vi.fn(async () => true) } as any,
  )
  return { repository, service }
}

describe('AiTtsQueryService.getMetaForArticle', () => {
  it('reports available with the block count', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-02'),
      blockCount: 3,
      sourceModifiedAt: new Date('2026-01-02'),
    })

    await expect(
      service.getMetaForArticle('1', 'zh', new Date('2026-01-02')),
    ).resolves.toEqual({
      available: true,
      lang: 'zh',
      blockCount: 3,
      stale: false,
      updatedAt: new Date('2026-01-02'),
    })
  })

  it('marks narration stale when the article was edited later', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-02'),
      blockCount: 3,
      sourceModifiedAt: new Date('2026-01-02'),
    })

    const meta = await service.getMetaForArticle(
      '1',
      'zh',
      new Date('2026-03-01'),
    )
    expect(meta.stale).toBe(true)
  })

  it('reports unavailable on a miss', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue(null)
    await expect(
      service.getMetaForArticle('1', 'zh', new Date()),
    ).resolves.toEqual({ available: false })
  })

  it('reports unavailable when the parent exists but block_order was never published', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-02'),
      blockCount: 0,
      sourceModifiedAt: null,
    })

    await expect(
      service.getMetaForArticle('1', 'zh', new Date()),
    ).resolves.toEqual({ available: false })
  })

  it('does not call the repository twice or load block rows for a single lookup', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue(null)

    await service.getMetaForArticle('1', 'zh', new Date())

    expect(repository.findMeta).toHaveBeenCalledTimes(1)
    expect(repository.findMeta).toHaveBeenCalledWith('1', 'zh')
    expect(repository.findBlocks).not.toHaveBeenCalled()
  })

  it('is not stale for a translation whose sourceModifiedAt already carries the translation vintage', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-02-15'),
      blockCount: 2,
      sourceModifiedAt: new Date('2026-02-10'),
    })

    const meta = await service.getMetaForArticle(
      '1',
      'en',
      new Date('2026-01-01'),
    )
    expect(meta.stale).toBe(false)
  })

  it('is stale for a translation whose vintage predates a later article edit', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-05'),
      blockCount: 2,
      sourceModifiedAt: new Date('2026-01-05'),
    })

    const meta = await service.getMetaForArticle(
      '1',
      'en',
      new Date('2026-02-01'),
    )
    expect(meta.stale).toBe(true)
  })

  it('treats a missing modifiedAt as never stale', async () => {
    const { repository, service } = createHarness()
    repository.findMeta.mockResolvedValue({
      id: '1',
      updatedAt: new Date('2026-01-02'),
      blockCount: 1,
      sourceModifiedAt: new Date('2026-01-02'),
    })

    const meta = await service.getMetaForArticle('1', 'zh', null)
    expect(meta.stale).toBe(false)
  })
})
