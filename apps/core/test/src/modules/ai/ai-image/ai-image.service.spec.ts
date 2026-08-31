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
  deps: {
    aiService?: unknown
    databaseService?: unknown
    draftRepository?: unknown
  } = {},
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
  const provider = {
    id: 'image-provider',
    name: 'Image Provider',
    type: 'openai-compatible',
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    defaultModel: config.model,
    enabled: true,
    capabilities: { text: false, image: true, speech: false },
  }
  const configService = {
    get: vi.fn().mockResolvedValue({
      imageGeneration: {
        enable: config.enable,
        model: { providerId: provider.id, model: config.model },
        defaultAspectRatio: config.defaultAspectRatio,
        defaultQuality: config.defaultQuality,
        defaultFormat: config.defaultFormat,
      },
    }),
    resolveAiProviderForCapability: vi
      .fn()
      .mockImplementation(
        async (_capability: string, assignment?: { model?: string }) =>
          provider.apiKey
            ? { provider, model: assignment?.model || undefined }
            : null,
      ),
  }
  const fileService = {
    uploadBuffer: vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/x.png',
      name: 'x.png',
    }),
  }
  const aiService = deps.aiService ?? { getWriterModel: vi.fn() }
  const databaseService = deps.databaseService ?? { findGlobalById: vi.fn() }
  const draftRepository = deps.draftRepository ?? { findById: vi.fn() }

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
    draftRepository as any,
  )
  service.onModuleInit()

  return {
    service,
    fileService,
    taskProcessor,
    aiService,
    databaseService,
    draftRepository,
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

    it('prefers the live draft over the published article when both ids are given', async () => {
      const generateStructured = vi.fn().mockResolvedValue({
        output: { prompt: 'A composition from the draft.' },
      })
      const aiService = {
        getWriterModel: vi.fn().mockResolvedValue({ generateStructured }),
      }
      const databaseService = {
        findGlobalById: vi.fn().mockResolvedValue(articleFixture()),
      }
      const draftRepository = {
        findBranchById: vi.fn().mockResolvedValue({
          headRevisionId: 'revision-1',
        }),
        findRevisionById: vi.fn().mockResolvedValue({
          title: 'The draft title',
          text: 'The draft body',
        }),
      }
      const { getHandler } = createService(
        {},
        { aiService, databaseService, draftRepository },
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

      await getHandler().execute(
        {
          presetId: SIGNAL_GEOMETRY_PRESET.id,
          draftId: 'draft-1',
          refId: 'article-1',
          purpose: 'cover',
          requestId: 'req-draft',
        },
        createContext(),
      )

      expect(draftRepository.findBranchById).toHaveBeenCalledWith('draft-1')
      expect(draftRepository.findRevisionById).toHaveBeenCalledWith(
        'revision-1',
      )
      expect(databaseService.findGlobalById).not.toHaveBeenCalled()
      expect(JSON.stringify(generateStructured.mock.calls[0])).toContain(
        'The draft title',
      )
    })

    it('compiles a preset prompt from the payload title and summary when the article is not saved yet', async () => {
      const generateStructured = vi.fn().mockResolvedValue({
        output: { prompt: 'A composition for an unsaved draft.' },
      })
      const aiService = {
        getWriterModel: vi.fn().mockResolvedValue({ generateStructured }),
      }
      const databaseService = { findGlobalById: vi.fn() }
      const { getHandler } = createService({}, { aiService, databaseService })
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
          title: 'An unsaved draft',
          summary: 'What the draft is about',
          purpose: 'cover',
          requestId: 'req-unsaved',
        },
        context,
      )

      expect(databaseService.findGlobalById).not.toHaveBeenCalled()
      expect(context.setResult).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'A composition for an unsaved draft.',
        }),
      )
    })

    it('falls back to the preset fallback prompt and logs a warn when the writer model fails, but the image still completes', async () => {
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

      expect(context.appendLog).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('no provider configured'),
      )
      expect(fileService.uploadBuffer).toHaveBeenCalled()
      expect(context.setResult).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: SIGNAL_GEOMETRY_PRESET.fallbackPrompt,
        }),
      )
    })

    it('degrade-path fallback prompt is a self-contained positive description, not the bare constraints block', () => {
      const { fallbackPrompt, hardConstraints } = SIGNAL_GEOMETRY_PRESET

      expect(fallbackPrompt.length).toBeGreaterThan(0)
      expect(fallbackPrompt).not.toBe(hardConstraints)
      expect(fallbackPrompt).not.toContain(hardConstraints)
      expect(fallbackPrompt).toMatch(/matte paper/i)
      expect(fallbackPrompt).toMatch(/grayscale/i)
      expect(fallbackPrompt).not.toMatch(/\p{Script=Han}/u)
    })

    it('degrade path never interpolates the raw article title into the fallback prompt', async () => {
      const aiService = {
        getWriterModel: vi
          .fn()
          .mockRejectedValue(new Error('no provider configured')),
      }
      const databaseService = {
        findGlobalById: vi.fn().mockResolvedValue({
          document: {
            title: '单机 4 GB VPS 上把 GitLab CE 跑起来',
            summary: 'x',
          },
          type: CollectionRefTypes.Post,
        }),
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
          refId: 'article-cn-title',
          purpose: 'cover',
          requestId: 'req-degrade-cn',
        },
        context,
      )

      expect(fileService.uploadBuffer).toHaveBeenCalled()
      expect(context.setResult).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: SIGNAL_GEOMETRY_PRESET.fallbackPrompt,
        }),
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
