import { createPgRepositoryMock, now } from 'test/helper/pg-repository-mock'
import { describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import type { AiTtsRepository } from '~/modules/ai/ai-tts/ai-tts.repository'
import { AiTtsQueryService } from '~/modules/ai/ai-tts/ai-tts-query.service'

const parentRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'tts-1',
  createdAt: now,
  updatedAt: now,
  refId: '1',
  lang: 'zh',
  isTranslation: false,
  sourceLang: null,
  model: 'gpt-4o-mini-tts',
  voice: 'alloy',
  speed: 1,
  format: 'mp3',
  blockOrder: ['blk-a', 'blk-b'],
  charCount: 20,
  totalDurationMs: null,
  sourceModifiedAt: now,
  ...overrides,
})

const blockRow = (
  blockId: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: `row-${blockId}`,
  createdAt: now,
  ttsId: 'tts-1',
  blockId,
  fingerprint: 'fp',
  chunkIndex: 0,
  text: 'narrated text',
  url: `https://cdn.example.com/${blockId}.mp3`,
  storageBackend: 's3' as const,
  storageKey: `k/${blockId}`,
  byteSize: 1,
  durationMs: null,
  ...overrides,
})

function createHarness() {
  const repository = createPgRepositoryMock<AiTtsRepository>()
  const databaseService = {
    findGlobalById: vi.fn(),
    getRefArticleMap: vi.fn().mockResolvedValue({}),
  }
  const service = new AiTtsQueryService(
    repository as any,
    databaseService as any,
  )
  return { repository, databaseService, service }
}

describe('AiTtsQueryService.getPublicNarration', () => {
  it('returns null when the article does not exist', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue(null)

    await expect(service.getPublicNarration('missing')).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('returns null for an unpublished (draft) post without touching the repository', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: { id: '1', title: 'Draft', isPublished: false },
    })

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('returns null for a password-protected note without touching the repository', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: { id: '1', title: 'Secret', isPublished: true, password: 'x' },
    })

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('returns null for a locked premium post without touching the repository', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Premium',
        isPublished: true,
        isPremium: true,
      },
    })

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('does not lock a premium note (premium only applies to posts)', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: { id: '1', title: 'Note', isPublished: true, isPremium: true },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow())
    repository.findBlocks.mockResolvedValue([blockRow('blk-a')])

    await expect(service.getPublicNarration('1')).resolves.not.toBeNull()
  })

  it('returns null when no narration exists yet for the resolved language', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Post',
        isPublished: true,
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(null)

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findBlocks).not.toHaveBeenCalled()
  })

  it('defaults to the article source language when none is requested', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Post',
        isPublished: true,
        meta: { lang: 'en-US' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow({ lang: 'en' }))
    repository.findBlocks.mockResolvedValue([blockRow('blk-a')])

    await service.getPublicNarration('1')

    expect(repository.findByRefAndLang).toHaveBeenCalledWith('1', 'en')
  })

  it('uses the requested language over the article default', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Post',
        isPublished: true,
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow({ lang: 'en' }))
    repository.findBlocks.mockResolvedValue([])

    await service.getPublicNarration('1', 'en')

    expect(repository.findByRefAndLang).toHaveBeenCalledWith('1', 'en')
  })

  it('returns the public narration shape with segments in order', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Post',
        isPublished: true,
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow())
    repository.findBlocks.mockResolvedValue([
      blockRow('blk-a', { chunkIndex: 0, text: 'first' }),
      blockRow('blk-b', { chunkIndex: 1, text: 'second' }),
    ])

    await expect(service.getPublicNarration('1')).resolves.toEqual({
      lang: 'zh',
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      blockOrder: ['blk-a', 'blk-b'],
      segments: [
        {
          blockId: 'blk-a',
          chunkIndex: 0,
          text: 'first',
          url: 'https://cdn.example.com/blk-a.mp3',
        },
        {
          blockId: 'blk-b',
          chunkIndex: 1,
          text: 'second',
          url: 'https://cdn.example.com/blk-b.mp3',
        },
      ],
    })
  })
})

describe('AiTtsQueryService.getDetailsByRefId', () => {
  it('returns an empty array when the ref has no narrations', async () => {
    const { repository, service } = createHarness()
    repository.findAllByRef.mockResolvedValue([])

    await expect(service.getDetailsByRefId('1')).resolves.toEqual([])
    expect(repository.findBlocks).not.toHaveBeenCalled()
  })

  it('loads blocks for every narration language of the ref', async () => {
    const { repository, service } = createHarness()
    repository.findAllByRef.mockResolvedValue([
      parentRow({ id: 'tts-1', lang: 'zh' }),
      parentRow({ id: 'tts-2', lang: 'en' }),
    ])
    repository.findBlocks.mockImplementation(async (ttsId: string) =>
      ttsId === 'tts-1' ? [blockRow('blk-a')] : [blockRow('blk-b')],
    )

    const result = await service.getDetailsByRefId('1')

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'tts-1', lang: 'zh' })
    expect(result[0].segments).toEqual([
      expect.objectContaining({ blockId: 'blk-a' }),
    ])
    expect(result[1]).toMatchObject({ id: 'tts-2', lang: 'en' })
    expect(result[1].segments).toEqual([
      expect.objectContaining({ blockId: 'blk-b' }),
    ])
  })
})

describe('AiTtsQueryService.list', () => {
  it('derives blockCount from blockOrder length', async () => {
    const { repository, service } = createHarness()
    repository.listPaginated.mockResolvedValue({
      data: [parentRow({ blockOrder: ['blk-a', 'blk-b', 'blk-c'] })],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await service.list({ page: 1, size: 10 })

    expect(repository.listPaginated).toHaveBeenCalledWith({
      page: 1,
      size: 10,
    })
    expect(result.data).toEqual([
      {
        id: 'tts-1',
        refId: '1',
        lang: 'zh',
        blockCount: 3,
        charCount: 20,
        updatedAt: now,
      },
    ])
    expect(result.pagination.total).toBe(1)
  })

  it('resolves article titles for the rows via the ref article map', async () => {
    const { databaseService, repository, service } = createHarness()
    repository.listPaginated.mockResolvedValue({
      data: [parentRow({ refId: '1' })],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })
    databaseService.getRefArticleMap.mockResolvedValue({
      '1': { id: '1', title: 'Hello world', type: 'Post' },
    })

    const result = await service.list({ page: 1, size: 10 })

    expect(databaseService.getRefArticleMap).toHaveBeenCalledWith(['1'])
    expect(result.articles).toEqual({
      '1': { id: '1', title: 'Hello world', type: 'Post' },
    })
  })
})
