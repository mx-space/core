import type { AssistantImages } from '@earendil-works/pi-ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import { SIGNAL_GEOMETRY_PRESET } from '~/modules/ai/ai.prompts'
import { AiImageService } from '~/modules/ai/ai-image/ai-image.service'
import { AITaskType } from '~/modules/ai/ai-task/ai-task.types'
import type { TaskExecuteContext } from '~/processors/task-queue'

const { generateOpenRouterImagesMock } = vi.hoisted(() => ({
  generateOpenRouterImagesMock: vi.fn(),
}))

vi.mock(
  '~/modules/ai/ai-image/openrouter-images-api',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('~/modules/ai/ai-image/openrouter-images-api')
      >()
    return {
      ...actual,
      generateOpenRouterImages: generateOpenRouterImagesMock,
    }
  },
)

function createContext(
  overrides: Partial<TaskExecuteContext> = {},
): TaskExecuteContext {
  return {
    taskId: 'task-1',
    signal: new AbortController().signal,
    updateProgress: vi.fn(),
    incrementTokens: vi.fn(),
    incrementCost: vi.fn(),
    appendLog: vi.fn(),
    setResult: vi.fn(),
    setStatus: vi.fn(),
    isAborted: () => false,
    streamPusher: vi.fn(),
    ...overrides,
  }
}

function createService(
  configOverrides: Record<string, unknown> = {},
  deps: { aiService?: unknown; databaseService?: unknown } = {},
) {
  const config = {
    enable: true,
    provider: 'openrouter',
    apiKey: 'test-api-key',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3-flash-image',
    defaultAspectRatio: '16:9',
    defaultQuality: 'standard',
    defaultFormat: 'png',
    ...configOverrides,
  }
  const configService = { get: vi.fn().mockResolvedValue(config) }
  const fileService = {
    uploadBuffer: vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/x.png',
      name: 'x.png',
    }),
  }
  const aiService = deps.aiService ?? { getWriterModel: vi.fn() }
  const databaseService = deps.databaseService ?? { findGlobalById: vi.fn() }

  let registeredHandler:
    | {
        type: string
        execute: (
          payload: unknown,
          context: TaskExecuteContext,
        ) => Promise<void>
      }
    | undefined

  const taskProcessor = {
    registerHandler: vi.fn((handler) => {
      registeredHandler = handler
    }),
  }

  const service = new AiImageService(
    configService as any,
    fileService as any,
    taskProcessor as any,
    aiService as any,
    databaseService as any,
  )
  service.onModuleInit()

  return {
    service,
    fileService,
    taskProcessor,
    aiService,
    databaseService,
    getHandler: () => registeredHandler!,
  }
}

describe('AiImageService image generation task handler', () => {
  beforeEach(() => {
    generateOpenRouterImagesMock.mockReset()
  })

  it('registers a handler for AITaskType.ImageGeneration on module init', () => {
    const { taskProcessor } = createService()

    expect(taskProcessor.registerHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: AITaskType.ImageGeneration }),
    )
  })

  it('throws IMAGE_GENERATION_DISABLED when the feature toggle is off', async () => {
    const { getHandler } = createService({ enable: false })

    await expect(
      getHandler().execute(
        { prompt: 'a cat', purpose: 'cover', requestId: 'req-1' },
        createContext(),
      ),
    ).rejects.toMatchObject({ code: AppErrorCode.IMAGE_GENERATION_DISABLED })
    expect(generateOpenRouterImagesMock).not.toHaveBeenCalled()
  })

  it('throws IMAGE_PROVIDER_NOT_CONFIGURED when apiKey/model are missing', async () => {
    const { getHandler } = createService({ apiKey: null, model: null })

    await expect(
      getHandler().execute(
        { prompt: 'a cat', purpose: 'cover', requestId: 'req-1' },
        createContext(),
      ),
    ).rejects.toMatchObject({
      code: AppErrorCode.IMAGE_PROVIDER_NOT_CONFIGURED,
    })
    expect(generateOpenRouterImagesMock).not.toHaveBeenCalled()
  })

  it('uses payload.model to override config.model as the outbound request model', async () => {
    const { getHandler } = createService({ model: 'config-default-model' })
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'payload-override-model',
      output: [
        {
          type: 'image',
          data: Buffer.from('fake-png-bytes').toString('base64'),
          mimeType: 'image/png',
        },
      ],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    await getHandler().execute(
      {
        prompt: 'a cat',
        purpose: 'cover',
        requestId: 'req-override',
        model: 'payload-override-model',
      },
      createContext(),
    )

    const [requestedModel] = generateOpenRouterImagesMock.mock.calls[0]
    expect(requestedModel.id).toBe('payload-override-model')
  })

  it('falls back to config.model when payload.model is absent', async () => {
    const { getHandler } = createService({ model: 'config-default-model' })
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'config-default-model',
      output: [
        {
          type: 'image',
          data: Buffer.from('fake-png-bytes').toString('base64'),
          mimeType: 'image/png',
        },
      ],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    await getHandler().execute(
      { prompt: 'a cat', purpose: 'cover', requestId: 'req-default' },
      createContext(),
    )

    const [requestedModel] = generateOpenRouterImagesMock.mock.calls[0]
    expect(requestedModel.id).toBe('config-default-model')
  })

  it('uploads the first returned image and records a task result on success', async () => {
    const { getHandler, fileService } = createService()
    const pngBytes = Buffer.from('fake-png-bytes')
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [
        {
          type: 'image',
          data: pngBytes.toString('base64'),
          mimeType: 'image/png',
        },
      ],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)
    const context = createContext()

    await getHandler().execute(
      { prompt: 'a cat', purpose: 'cover', requestId: 'req-1' },
      context,
    )

    expect(fileService.uploadBuffer).toHaveBeenCalledWith(expect.any(Buffer), {
      type: 'image',
      originalFilename: 'ai-cover-req-1.png',
      contentType: 'image/png',
    })
    expect(context.setResult).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/x.png',
      mimeType: 'image/png',
      prompt: 'a cat',
    })
  })

  it('throws instead of silently succeeding when the runtime reports stopReason: error', async () => {
    const { getHandler, fileService } = createService()
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [],
      stopReason: 'error',
      errorMessage: 'rate limited by upstream',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)
    const context = createContext()

    await expect(
      getHandler().execute(
        { prompt: 'a cat', purpose: 'cover', requestId: 'req-1' },
        context,
      ),
    ).rejects.toMatchObject({
      code: AppErrorCode.IMAGE_GENERATION_FAILED,
      message: 'rate limited by upstream',
    })

    expect(fileService.uploadBuffer).not.toHaveBeenCalled()
    expect(context.setResult).not.toHaveBeenCalled()
  })

  it('throws IMAGE_GENERATION_FAILED when stopReason is stop but no images are returned', async () => {
    const { getHandler, fileService } = createService()
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [{ type: 'text', text: 'I cannot generate that image.' }],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)
    const context = createContext()

    await expect(
      getHandler().execute(
        { prompt: 'a cat', purpose: 'cover', requestId: 'req-1' },
        context,
      ),
    ).rejects.toMatchObject({
      code: AppErrorCode.IMAGE_GENERATION_FAILED,
      message: 'image runtime returned no images',
    })

    expect(fileService.uploadBuffer).not.toHaveBeenCalled()
    expect(context.setResult).not.toHaveBeenCalled()
  })

  describe('preset-mode compilation (no prompt in the payload)', () => {
    function articleFixture() {
      return {
        document: { title: 'A note about orbital mechanics', summary: 'x' },
        type: CollectionRefTypes.Post,
      }
    }

    it('compiles a prompt via the writer model and uses it as the generation prompt', async () => {
      const generateStructured = vi.fn().mockResolvedValue({
        output: { prompt: 'A calm orbital composition, compiled server-side.' },
      })
      const aiService = {
        getWriterModel: vi.fn().mockResolvedValue({
          generateStructured,
        }),
      }
      const databaseService = {
        findGlobalById: vi.fn().mockResolvedValue(articleFixture()),
      }
      const { getHandler, fileService } = createService(
        {},
        { aiService, databaseService },
      )
      const assistantImages: AssistantImages = {
        api: 'openrouter-images-api',
        provider: 'openrouter',
        model: 'google/gemini-3-flash-image',
        output: [
          {
            type: 'image',
            data: Buffer.from('fake-png-bytes').toString('base64'),
            mimeType: 'image/png',
          },
        ],
        stopReason: 'stop',
        timestamp: Date.now(),
      }
      generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)
      const context = createContext()

      await getHandler().execute(
        {
          presetId: SIGNAL_GEOMETRY_PRESET.id,
          refId: 'article-1',
          purpose: 'cover',
          requestId: 'req-preset',
        },
        context,
      )

      expect(databaseService.findGlobalById).toHaveBeenCalledWith('article-1')
      expect(fileService.uploadBuffer).toHaveBeenCalled()
      expect(context.setResult).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A calm orbital composition, compiled server-side.',
        }),
      )
    })

    it('falls back to title + hardConstraints and logs a warn when the writer model fails, but the image still completes', async () => {
      const aiService = {
        getWriterModel: vi
          .fn()
          .mockRejectedValue(new Error('no provider configured')),
      }
      const databaseService = {
        findGlobalById: vi.fn().mockResolvedValue(articleFixture()),
      }
      const { getHandler, fileService } = createService(
        {},
        { aiService, databaseService },
      )
      const assistantImages: AssistantImages = {
        api: 'openrouter-images-api',
        provider: 'openrouter',
        model: 'google/gemini-3-flash-image',
        output: [
          {
            type: 'image',
            data: Buffer.from('fake-png-bytes').toString('base64'),
            mimeType: 'image/png',
          },
        ],
        stopReason: 'stop',
        timestamp: Date.now(),
      }
      generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)
      const context = createContext()

      await getHandler().execute(
        {
          presetId: SIGNAL_GEOMETRY_PRESET.id,
          refId: 'article-1',
          purpose: 'cover',
          requestId: 'req-degrade',
        },
        context,
      )

      const fallbackPrompt = `A note about orbital mechanics\n\n${SIGNAL_GEOMETRY_PRESET.hardConstraints}`
      expect(context.appendLog).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('no provider configured'),
      )
      expect(fileService.uploadBuffer).toHaveBeenCalled()
      expect(context.setResult).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: fallbackPrompt }),
      )
    })

    it('throws AI_INVALID_PARAMETER when prompt is omitted and presetId/refId are missing', async () => {
      const { getHandler } = createService()

      await expect(
        getHandler().execute(
          { purpose: 'cover', requestId: 'req-invalid' },
          createContext(),
        ),
      ).rejects.toMatchObject({ code: AppErrorCode.AI_INVALID_PARAMETER })
      expect(generateOpenRouterImagesMock).not.toHaveBeenCalled()
    })
  })
})
