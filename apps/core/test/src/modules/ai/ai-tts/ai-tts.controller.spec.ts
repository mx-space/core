import { describe, expect, it, vi } from 'vitest'

import { AiTtsController } from '~/modules/ai/ai-tts/ai-tts.controller'

function createHarness() {
  const service: any = {
    deleteById: vi.fn(),
  }
  const queryService: any = {
    getPublicNarration: vi.fn(),
    getDetailsByRefId: vi.fn(),
    list: vi.fn(),
  }
  const taskService: any = {
    createTtsTask: vi.fn(async () => ({ taskId: 'task-1', created: true })),
  }
  const controller = new AiTtsController(service, queryService, taskService)
  return { controller, service, queryService, taskService }
}

describe('AiTtsController', () => {
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
    expect(queryService.getPublicNarration).toHaveBeenCalledWith('1', undefined)
  })

  it('canonicalizes an explicit lang query param before delegating', async () => {
    const { controller, queryService } = createHarness()
    queryService.getPublicNarration.mockResolvedValue(null)

    await controller.getArticleTts({ id: '1' } as any, { lang: 'zh-CN' } as any)

    expect(queryService.getPublicNarration).toHaveBeenCalledWith('1', 'zh')
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

  it('lists narrations wrapped with pagination meta', async () => {
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
    })

    const result = await controller.list({ page: 1, size: 10 } as any)

    expect(result.data).toHaveLength(1)
    expect(result.meta.pagination).toMatchObject({ total: 1, page: 1 })
  })

  it('returns narration details for a ref', async () => {
    const { controller, queryService } = createHarness()
    queryService.getDetailsByRefId.mockResolvedValue([
      {
        id: 'tts-1',
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
    ])

    const result = await controller.getByRefId({ id: '1' } as any)

    expect(result).toHaveLength(1)
    expect(queryService.getDetailsByRefId).toHaveBeenCalledWith('1')
  })

  it('delegates delete to the service', async () => {
    const { controller, service } = createHarness()

    await controller.delete({ id: 'tts-1' } as any)

    expect(service.deleteById).toHaveBeenCalledWith('tts-1')
  })
})
