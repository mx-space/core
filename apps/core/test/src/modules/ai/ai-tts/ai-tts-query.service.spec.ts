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

function createHarness(options: { storedNotePassword?: string } = {}) {
  const repository = createPgRepositoryMock<AiTtsRepository>()
  const databaseService = {
    findGlobalById: vi.fn(),
    getRefArticleMap: vi.fn().mockResolvedValue({}),
  }
  const entitlementService = {
    isPremiumLocked: vi.fn(
      async (input: {
        isPremium?: boolean | null
        isOwner: boolean
        readerId?: string
      }) => Boolean(input.isPremium) && !input.isOwner && !input.readerId,
    ),
  }
  const noteService = {
    checkPasswordToAccess: vi.fn(async (_id: string, password?: string) => {
      if (!options.storedNotePassword) return true
      return password === options.storedNotePassword
    }),
  }
  const service = new AiTtsQueryService(
    repository as any,
    databaseService as any,
    entitlementService as any,
    noteService as any,
  )
  return {
    repository,
    databaseService,
    entitlementService,
    noteService,
    service,
  }
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

  it('returns null for a password-protected note when no password is supplied', async () => {
    const { databaseService, repository, service } = createHarness({
      storedNotePassword: 'letmein',
    })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {
        id: '1',
        title: 'Secret',
        isPublished: true,
        hasPassword: true,
      },
    })

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('returns null for a password-protected note when the password is wrong', async () => {
    const { databaseService, repository, service } = createHarness({
      storedNotePassword: 'letmein',
    })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {
        id: '1',
        title: 'Secret',
        isPublished: true,
        hasPassword: true,
      },
    })

    await expect(
      service.getPublicNarration('1', undefined, { password: 'nope' }),
    ).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('serves a password-protected note to a reader who supplies the password', async () => {
    const { databaseService, repository, service } = createHarness({
      storedNotePassword: 'letmein',
    })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {
        id: '1',
        title: 'Secret',
        isPublished: true,
        hasPassword: true,
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow())
    repository.findBlocks.mockResolvedValue([blockRow('blk-a')])

    await expect(
      service.getPublicNarration('1', undefined, { password: 'letmein' }),
    ).resolves.not.toBeNull()
  })

  it('returns null for a future-dated note even when the password is correct', async () => {
    const { databaseService, repository, service } = createHarness({
      storedNotePassword: 'letmein',
    })
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {
        id: '1',
        title: 'Scheduled and locked',
        isPublished: true,
        hasPassword: true,
        publicAt: new Date(Date.now() + 86_400_000),
      },
    })

    await expect(
      service.getPublicNarration('1', undefined, { password: 'letmein' }),
    ).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('returns null for a future-dated secret note viewed anonymously', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {
        id: '1',
        title: 'Scheduled',
        isPublished: true,
        publicAt: new Date(Date.now() + 86_400_000),
      },
    })

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findByRefAndLang).not.toHaveBeenCalled()
  })

  it('serves a future-dated secret note to the owner', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Note,
      document: {
        id: '1',
        title: 'Scheduled',
        isPublished: true,
        publicAt: new Date(Date.now() + 86_400_000),
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow())
    repository.findBlocks.mockResolvedValue([blockRow('blk-a')])

    await expect(
      service.getPublicNarration('1', undefined, { isOwner: true }),
    ).resolves.not.toBeNull()
  })

  it('returns null for a premium post an anonymous reader is not entitled to', async () => {
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

  it('serves a premium post to an entitled reader', async () => {
    const { databaseService, entitlementService, repository, service } =
      createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Premium',
        isPublished: true,
        isPremium: true,
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow())
    repository.findBlocks.mockResolvedValue([blockRow('blk-a')])

    await expect(
      service.getPublicNarration('1', undefined, { readerId: 'reader-1' }),
    ).resolves.not.toBeNull()
    expect(entitlementService.isPremiumLocked).toHaveBeenCalledWith({
      isPremium: true,
      isOwner: false,
      readerId: 'reader-1',
    })
  })

  it('serves a premium post to the owner', async () => {
    const { databaseService, repository, service } = createHarness()
    databaseService.findGlobalById.mockResolvedValue({
      type: CollectionRefTypes.Post,
      document: {
        id: '1',
        title: 'Premium',
        isPublished: true,
        isPremium: true,
        meta: { lang: 'zh' },
      },
    })
    repository.findByRefAndLang.mockResolvedValue(parentRow())
    repository.findBlocks.mockResolvedValue([blockRow('blk-a')])

    await expect(
      service.getPublicNarration('1', undefined, { isOwner: true }),
    ).resolves.not.toBeNull()
  })

  it('returns null when the parent exists but block_order was never published', async () => {
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
    repository.findByRefAndLang.mockResolvedValue(parentRow({ blockOrder: [] }))

    await expect(service.getPublicNarration('1')).resolves.toBeNull()
    expect(repository.findBlocks).not.toHaveBeenCalled()
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

  it('orders segments by blockOrder even when the rows arrive scrambled', async () => {
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
    repository.findByRefAndLang.mockResolvedValue(
      parentRow({ blockOrder: ['blk-c', 'blk-a', 'blk-b'] }),
    )
    repository.findBlocks.mockResolvedValue([
      blockRow('blk-a', { chunkIndex: 0 }),
      blockRow('blk-b', { chunkIndex: 0 }),
      blockRow('blk-c', { chunkIndex: 1, id: 'row-blk-c-1' }),
      blockRow('blk-c', { chunkIndex: 0 }),
    ])

    const result = await service.getPublicNarration('1')

    expect(result!.segments.map((s) => [s.blockId, s.chunkIndex])).toEqual([
      ['blk-c', 0],
      ['blk-c', 1],
      ['blk-a', 0],
      ['blk-b', 0],
    ])
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
