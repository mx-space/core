import { describe, expect, it, vi } from 'vitest'

import { AiTtsController } from '~/modules/ai/ai-tts/ai-tts.controller'

function createHarness() {
  const service: any = {
    deleteById: vi.fn(),
  }
  const queryService: any = {
    getPublicNarration: vi.fn(),
    getDetailsByRefId: vi.fn(),
    getNarrationsByRefId: vi.fn(),
    getAllNarrationsGrouped: vi.fn(),
    list: vi.fn(),
  }
  const taskService: any = {
    createTtsTask: vi.fn(async () => ({ taskId: 'task-1', created: true })),
  }
  const voiceCatalogService: any = {
    discover: vi.fn(),
  }
  const controller = new AiTtsController(
    service,
    queryService,
    taskService,
    voiceCatalogService,
  )
  return {
    controller,
    service,
    queryService,
    taskService,
    voiceCatalogService,
  }
}

describe('AiTtsController', () => {
  it('delegates voice discovery with the selected provider and model', async () => {
    const { controller, voiceCatalogService } = createHarness()
    voiceCatalogService.discover.mockResolvedValue({
      manualInputAllowed: true,
      source: 'builtin',
      voices: [{ id: 'alloy', kind: 'builtin', name: 'Alloy' }],
    })

    await expect(
      controller.discoverVoices({
        providerId: 'openai-main',
        model: 'gpt-4o-mini-tts',
      }),
    ).resolves.toMatchObject({ source: 'builtin' })
    expect(voiceCatalogService.discover).toHaveBeenCalledWith({
      providerId: 'openai-main',
      model: 'gpt-4o-mini-tts',
    })
  })

  it('returns null for an article with no narration', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue(null)

    await expect(
      controller.getArticleTts({ id: '1' } as any, {} as any),
    ).resolves.toBeNull()
  })

  it('returns null for an unpublished article', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue(null)

    expect(
      await controller.getArticleTts({ id: 'draft' } as any, {} as any),
    ).toBeNull()
  })

  it('returns null for a locked premium article', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue(null)

    expect(
      await controller.getArticleTts({ id: 'premium' } as any, {} as any),
    ).toBeNull()
  })

  it('parses a found narration through the public view', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue({
      lang: 'zh',
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      blockOrder: ['blk-a'],
      segments: [
        {
          blockId: 'blk-a',
          chunkIndex: 0,
          text: 'hello',
          url: 'https://x/a.mp3',
        },
      ],
    })

    const result = await controller.getArticleTts({ id: '1' } as any, {} as any)

    expect(result).toMatchObject({ lang: 'zh', voice: 'alloy' })
    expect(queryService.getPublicNarration).toHaveBeenCalledWith(
      '1',
      undefined,
      {
        isOwner: false,
        password: undefined,
        readerId: undefined,
      },
    )
  })

  it('canonicalizes an explicit lang query param before delegating', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue(null)

    await controller.getArticleTts({ id: '1' } as any, { lang: 'zh-CN' } as any)

    expect(queryService.getPublicNarration).toHaveBeenCalledWith('1', 'zh', {
      isOwner: false,
      password: undefined,
      readerId: undefined,
    })
  })

  it('forwards owner access, reader identity and the note password to the query service', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue(null)

    await controller.getArticleTts(
      { id: '1' } as any,
      { password: 'letmein' } as any,
      true,
      'reader-1',
    )

    expect(queryService.getPublicNarration).toHaveBeenCalledWith(
      '1',
      undefined,
      {
        isOwner: true,
        password: 'letmein',
        readerId: 'reader-1',
      },
    )
  })

  it('enqueues a task with the canonical language list', async () => {
    const { controller, taskService } = createHarness()

    await controller.createTask({ refId: '1', langs: ['zh-CN', 'zh'] } as any)

    expect(taskService.createTtsTask).toHaveBeenCalledWith(
      expect.objectContaining({ refId: '1', langs: ['zh'] }),
    )
  })

  it('omits langs from the task payload when none are requested', async () => {
    const { controller, taskService } = createHarness()

    await controller.createTask({ refId: '1' } as any)

    expect(taskService.createTtsTask).toHaveBeenCalledWith(
      expect.objectContaining({ refId: '1', langs: undefined }),
    )
  })

  it('lists narrations wrapped with pagination and article meta', async () => {
    const { controller, queryService } = createHarness()
    queryService.list.mockResolvedValue({
      data: [
        {
          id: 'tts-1',
          refId: '1',
          lang: 'zh',
          blockCount: 2,
          charCount: 20,
          updatedAt: new Date('2026-01-01'),
        },
      ],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
      articles: { '1': { id: '1', title: 'Hello world', type: 'Post' } },
    })

    const result = await controller.list({ page: 1, size: 10 } as any)

    expect(result.data).toHaveLength(1)
    expect(result.meta.pagination).toMatchObject({ total: 1, page: 1 })
    expect(result.meta.articles).toEqual({
      '1': { id: '1', title: 'Hello world', type: 'Post' },
    })
  })

  it('returns narration details for a ref together with the article', async () => {
    const { controller, queryService } = createHarness()
    queryService.getNarrationsByRefId.mockResolvedValue({
      article: {
        type: 'Post',
        document: { id: '1', title: 'Hello world' },
      },
      rows: [
        {
          id: 'tts-1',
          refId: '1',
          lang: 'zh',
          isTranslation: false,
          model: 'gpt-4o-mini-tts',
          voice: 'alloy',
          speed: 1,
          blockOrder: ['blk-a'],
          charCount: 10,
          updatedAt: null,
          segments: [],
        },
      ],
    })

    const result = await controller.getByRefId({ id: '1' } as any)

    expect(queryService.getNarrationsByRefId).toHaveBeenCalledWith('1')
    expect(result.article).toMatchObject({ type: 'Post' })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ id: 'tts-1', refId: '1' })
  })

  it('wraps grouped narrations with pagination meta', async () => {
    const { controller, queryService } = createHarness()
    queryService.getAllNarrationsGrouped.mockResolvedValue({
      data: [
        {
          article: { id: '1', title: 'Hello world', type: 'Post' },
          narrations: [
            {
              id: 'tts-1',
              refId: '1',
              lang: 'zh',
              isTranslation: false,
              model: 'gpt-4o-mini-tts',
              voice: 'alloy',
              speed: 1,
              blockOrder: ['blk-a'],
              charCount: 10,
              updatedAt: null,
              segments: [],
            },
          ],
        },
      ],
      pagination: {
        currentPage: 1,
        totalPage: 1,
        total: 1,
        size: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    const result = await controller.listGrouped({ page: 1, size: 10 } as any)

    expect(queryService.getAllNarrationsGrouped).toHaveBeenCalledWith({
      page: 1,
      size: 10,
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].article).toMatchObject({ id: '1' })
    expect(result.data[0].narrations[0]).toMatchObject({
      id: 'tts-1',
      refId: '1',
    })
    expect(result.meta.pagination).toMatchObject({ total: 1, page: 1 })
  })

  it('delegates delete to the service', async () => {
    const { controller, service } = createHarness()

    await controller.delete({ id: 'tts-1' } as any)

    expect(service.deleteById).toHaveBeenCalledWith('tts-1')
  })
})
