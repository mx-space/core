import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { AiImageService } from '~/modules/ai/ai-image/ai-image.service'
import { AITaskType } from '~/modules/ai/ai-task/ai-task.types'

describe('AiImageService', () => {
  let service: AiImageService
  const taskProcessor = {
    registerHandler: vi.fn(),
  }
  const configService = {
    get: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AiImageService(
      configService as any,
      {
        generateCoverPromptByOpenAI: vi.fn(),
      } as any,
      {
        findGlobalById: vi.fn(),
        getModelByRefType: vi.fn(),
      } as any,
      {} as any,
      {} as any,
      {
        axiosRef: {
          get: vi.fn(),
        },
      } as any,
      {} as any,
      taskProcessor as any,
    )
  })

  it('registers the cover task handler on module init', () => {
    service.onModuleInit()

    expect(taskProcessor.registerHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AITaskType.Cover,
        execute: expect.any(Function),
      }),
    )
  })

  it('builds prompt source from lexical content and normalizes whitespace', () => {
    const result = (service as any).buildPromptSource({
      title: 'Fallback title',
      text: 'Fallback text',
      contentFormat: 'lexical',
      content: JSON.stringify({
        root: {
          type: 'root',
          version: 1,
          children: [
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: 'Line 1',
                },
                {
                  type: 'text',
                  version: 1,
                  text: '   Line 2',
                },
              ],
            },
          ],
        },
      }),
    })

    expect(result).toBe('Line 1 Line 2')
  })

  it('rejects cover generation when jimeng credentials are incomplete', async () => {
    configService.get.mockResolvedValue({
      enableCoverGeneration: true,
      jimengOptions: {
        accessKeyId: 'ak',
        secretAccessKey: '',
      },
    })

    await expect((service as any).resolveJimengConfig()).rejects.toMatchObject({
      bizCode: ErrorCodeEnum.AINotEnabled,
    })
  })

  it('parses serialized meta when resolving articles', async () => {
    ;(service as any).databaseService.findGlobalById = vi
      .fn()
      .mockResolvedValue({
        type: CollectionRefTypes.Post,
        document: {
          id: 'post-1',
          title: 'Post',
          text: 'Body',
          meta: JSON.stringify({
            cover: 'https://img.example/cover.png',
          }),
        },
      })

    const result = await (service as any).resolveArticle('post-1')

    expect(result.meta).toEqual({
      cover: 'https://img.example/cover.png',
    })
  })

  it('rejects recently items when resolving article references', async () => {
    ;(service as any).databaseService.findGlobalById = vi
      .fn()
      .mockResolvedValue({
        type: CollectionRefTypes.Recently,
        document: {
          id: 'recent-1',
          title: 'Recent',
          text: 'Body',
        },
      })

    await expect(
      (service as any).resolveArticle('recent-1'),
    ).rejects.toMatchObject({
      bizCode: ErrorCodeEnum.ContentNotFoundCantProcess,
    })
  })

  it('decodes data-url images without using http download', async () => {
    const result = await (service as any).downloadGeneratedImage(
      'data:image/png;base64,aGVsbG8=',
    )

    expect(result.contentType).toBe('image/png')
    expect(result.buffer.toString()).toBe('hello')
  })
})
