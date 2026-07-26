import type { AssistantImages } from '@earendil-works/pi-ai'
import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { redisHelper } from 'test/helper/redis-mock.helper'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AppErrorCode } from '~/common/errors'
import { CollectionRefTypes } from '~/constants/db.constant'
import { SIGNAL_GEOMETRY_PRESET } from '~/modules/ai/ai.prompts'
import { AiService } from '~/modules/ai/ai.service'
import { AIProviderType } from '~/modules/ai/ai.types'
import { AiImageController } from '~/modules/ai/ai-image/ai-image.controller'
import { AiImageService } from '~/modules/ai/ai-image/ai-image.service'
import { clearImageCatalogCache } from '~/modules/ai/ai-image/image-catalog'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import type { TaskExecuteContext } from '~/processors/task-queue'
import { TaskQueueService } from '~/processors/task-queue'

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

const noopEmitter = {
  emitCreated: vi.fn(),
  emitStarted: vi.fn(),
  emitStatus: vi.fn(),
  emitResult: vi.fn(),
  emitDeleted: vi.fn(),
  emitLog: vi.fn(),
  emitStream: vi.fn(),
  emitProgress: vi.fn(),
  dispose: vi.fn(),
}

const processorStub = {
  registerHandler: vi.fn(),
  getRetryBuilder: () => undefined,
}

function baseImageConfig() {
  return {
    enable: true,
    provider: 'openrouter',
    apiKey: 'test-api-key',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3-flash-image',
    defaultAspectRatio: '16:9',
    defaultQuality: 'standard',
    defaultFormat: 'png',
  }
}

const aiServiceMock = { getWriterModel: vi.fn() }
const databaseServiceMock = { findGlobalById: vi.fn() }
let imageConfig = baseImageConfig()
const configsServiceMock = {
  get: vi.fn(async (key: string) => {
    if (key === 'imageGenerationOptions') return imageConfig
    return {}
  }),
}

function createStandaloneImageService(
  config: ReturnType<typeof baseImageConfig>,
) {
  const fileService = {
    uploadBuffer: vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/x.png',
      name: 'x.png',
    }),
  }
  let registeredHandler:
    | {
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
  const localConfigService = { get: vi.fn().mockResolvedValue(config) }
  const service = new AiImageService(
    localConfigService as any,
    fileService as any,
    taskProcessor as any,
    aiServiceMock as any,
    databaseServiceMock as any,
  )
  service.onModuleInit()
  return { fileService, getHandler: () => registeredHandler! }
}

function createTaskContext(
  overrides: Partial<TaskExecuteContext> = {},
): TaskExecuteContext {
  return {
    taskId: 'task-x',
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

function mountFauxWriter(recipe: Record<string, string>, prompt: string) {
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: 'faux-cover',
    models: [{ id: 'faux-cover-model', name: 'faux-cover-model' }],
    responses: [
      fauxAssistantMessage([
        fauxToolCall('structured_output', { recipe, prompt }),
      ]),
    ],
  })

  aiServiceMock.getWriterModel.mockResolvedValueOnce(
    new PiRuntimeAdapter({
      apiKey: 'k',
      endpoint: 'https://faux-cover.example.com',
      model: 'faux-cover-model',
      providerType: AIProviderType.OpenAICompatible,
      providerId: 'faux-cover',
    }),
  )

  return handle
}

const SIGNAL_GEOMETRY_RECIPE = {
  format: '16:9',
  polarity: 'dark',
  family: 'orbital',
  transformation: 'converging',
  geometry: 'radial',
  scaffold: 'open field',
  anchor: 'central node',
  accent: 'none',
  text: 'none',
}

let taskQueueService: TaskQueueService
const torn: Array<() => void> = []

describe('AiImageController (faux e2e)', () => {
  const proxy = createE2EApp({
    controllers: [AiImageController],
    providers: [
      { provide: AiService, useValue: aiServiceMock },
      { provide: ConfigsService, useValue: configsServiceMock },
      { provide: DatabaseService, useValue: databaseServiceMock },
      {
        provide: TaskQueueService,
        useFactory: async () =>
          new TaskQueueService(
            (await redisHelper).RedisService as any,
            noopEmitter as any,
            processorStub as any,
          ),
      },
      AiTaskService,
    ],
  })

  beforeEach(async () => {
    const { RedisService: redis } = await redisHelper
    await redis.getClient().flushall()
    taskQueueService = proxy.app.get(TaskQueueService)
    imageConfig = baseImageConfig()
    generateOpenRouterImagesMock.mockReset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    while (torn.length) torn.pop()!()
    vi.restoreAllMocks()
    clearImageCatalogCache()
  })

  it('POST /ai/image/generate enqueues a task and returns { taskId, created } with status 200', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        prompt: 'a cat wearing sunglasses',
        purpose: 'cover',
        requestId: 'req-1',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(typeof body.data.task_id).toBe('string')
    expect(body.data.created).toBe(true)
  })

  it('same prompt with two different requestIds yields two distinct taskIds (dedup opt-out)', async () => {
    const first = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        prompt: 'a cat wearing sunglasses',
        purpose: 'cover',
        requestId: 'req-a',
      },
    })
    const second = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        prompt: 'a cat wearing sunglasses',
        purpose: 'cover',
        requestId: 'req-b',
      },
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(second.json().data.created).toBe(true)
    expect(first.json().data.task_id).not.toBe(second.json().data.task_id)
  })

  it('POST /ai/image/generate with a model override persists it on the task payload', async () => {
    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        prompt: 'a cat wearing sunglasses',
        purpose: 'cover',
        requestId: 'req-model-override',
        model: 'openai/gpt-image-1',
      },
    })
    const taskId = res.json().data.task_id
    const task = await taskQueueService.getTask(taskId)

    expect((task!.payload as { model?: string }).model).toBe(
      'openai/gpt-image-1',
    )
  })

  it('POST /ai/image/generate in preset mode (no prompt) enqueues and, on execution, compiles the prompt server-side', async () => {
    databaseServiceMock.findGlobalById.mockResolvedValueOnce({
      document: { title: 'Orbital drift', summary: 'about orbits' },
      type: CollectionRefTypes.Post,
    })
    const handle = mountFauxWriter(
      SIGNAL_GEOMETRY_RECIPE,
      'A calm orbital composition on charcoal matte paper.',
    )
    torn.push(() => handle.teardown())

    const enqueued = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        presetId: 'signal-geometry',
        refId: 'article-preset-mode',
        purpose: 'cover',
        requestId: 'req-preset-mode',
      },
    })
    expect(enqueued.statusCode).toBe(200)
    const taskId = enqueued.json().data.task_id
    const task = await taskQueueService.getTask(taskId)
    expect((task!.payload as { prompt?: string }).prompt).toBeUndefined()
    expect((task!.payload as { presetId?: string }).presetId).toBe(
      'signal-geometry',
    )

    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: baseImageConfig().model,
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

    const { getHandler, fileService } =
      createStandaloneImageService(baseImageConfig())
    const context = createTaskContext({ taskId })

    await getHandler().execute(task!.payload, context)

    expect(databaseServiceMock.findGlobalById).toHaveBeenCalledWith(
      'article-preset-mode',
    )
    expect(fileService.uploadBuffer).toHaveBeenCalled()
    expect(context.setResult).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'A calm orbital composition on charcoal matte paper.',
      }),
    )
  })

  it('preset-mode generation degrades to the preset fallback prompt and logs a warn when compilation fails, but still produces an image', async () => {
    databaseServiceMock.findGlobalById.mockResolvedValueOnce({
      document: {
        title: '单机 4 GB VPS 上把 GitLab CE 跑起来',
        summary: 'about orbits',
      },
      type: CollectionRefTypes.Post,
    })
    aiServiceMock.getWriterModel.mockRejectedValueOnce(
      new Error('No AI provider configured'),
    )

    const enqueued = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        presetId: 'signal-geometry',
        refId: 'article-degrade',
        purpose: 'cover',
        requestId: 'req-degrade-mode',
      },
    })
    const taskId = enqueued.json().data.task_id
    const task = await taskQueueService.getTask(taskId)

    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: baseImageConfig().model,
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

    const { getHandler, fileService } =
      createStandaloneImageService(baseImageConfig())
    const context = createTaskContext({ taskId })

    await getHandler().execute(task!.payload, context)

    expect(context.appendLog).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('No AI provider configured'),
    )
    expect(fileService.uploadBuffer).toHaveBeenCalled()
    expect(context.setResult).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: SIGNAL_GEOMETRY_PRESET.fallbackPrompt,
      }),
    )
    const [calledResult] = vi.mocked(context.setResult).mock.calls[0]
    expect((calledResult as { prompt: string }).prompt).not.toContain('单机')
  })

  it('executing the queued task while image generation is disabled fails with IMAGE_GENERATION_DISABLED', async () => {
    const enqueued = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        prompt: 'a cat',
        purpose: 'cover',
        requestId: 'req-disabled',
      },
    })
    const taskId = enqueued.json().data.task_id
    const task = await taskQueueService.getTask(taskId)

    const { getHandler } = createStandaloneImageService({
      ...baseImageConfig(),
      enable: false,
    })

    await expect(
      getHandler().execute(task!.payload, createTaskContext({ taskId })),
    ).rejects.toMatchObject({ code: AppErrorCode.IMAGE_GENERATION_DISABLED })
    expect(generateOpenRouterImagesMock).not.toHaveBeenCalled()
  })

  it('runtime stopReason: error fails the task with errorMessage and uploads no image', async () => {
    const enqueued = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/generate`,
      headers: authPassHeader,
      payload: {
        prompt: 'a cat',
        purpose: 'cover',
        requestId: 'req-error',
      },
    })
    const taskId = enqueued.json().data.task_id
    const task = await taskQueueService.getTask(taskId)

    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: baseImageConfig().model,
      output: [],
      stopReason: 'error',
      errorMessage: 'rate limited by upstream',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    const { getHandler, fileService } =
      createStandaloneImageService(baseImageConfig())

    await expect(
      getHandler().execute(task!.payload, createTaskContext({ taskId })),
    ).rejects.toMatchObject({
      code: AppErrorCode.IMAGE_GENERATION_FAILED,
      message: 'rate limited by upstream',
    })
    expect(fileService.uploadBuffer).not.toHaveBeenCalled()
  })

  it('POST /ai/image/draft-prompt compiles a prompt + recipe with status 200', async () => {
    const handle = mountFauxWriter(
      SIGNAL_GEOMETRY_RECIPE,
      'A calm orbital composition on charcoal matte paper.',
    )
    torn.push(() => handle.teardown())

    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/draft-prompt`,
      headers: authPassHeader,
      payload: {
        presetId: 'signal-geometry',
        title: 'Hello',
        summary: 'World',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.prompt).toBe(
      'A calm orbital composition on charcoal matte paper.',
    )
    expect(body.data.recipe.family).toBe('orbital')
  })

  it('POST /ai/image/draft-prompt with refId falls back to an empty summary when the article has no text (no crash on null text)', async () => {
    databaseServiceMock.findGlobalById.mockResolvedValueOnce({
      document: { title: 'Draft in progress', text: null },
      type: CollectionRefTypes.Note,
    })

    const handle = mountFauxWriter(
      SIGNAL_GEOMETRY_RECIPE,
      'A minimal composition anchored by a single title.',
    )
    torn.push(() => handle.teardown())

    const res = await proxy.app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/ai/image/draft-prompt`,
      headers: authPassHeader,
      payload: {
        presetId: 'signal-geometry',
        refId: 'note-empty-body',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(databaseServiceMock.findGlobalById).toHaveBeenCalledWith(
      'note-empty-body',
    )
    expect(res.json().data.prompt).toBe(
      'A minimal composition anchored by a single title.',
    )
  })

  describe('GET /ai/image/models', () => {
    it('fetches the live OpenRouter catalog and exposes supported_parameters', async () => {
      imageConfig = {
        ...baseImageConfig(),
        endpoint: 'https://models-test-1.example.com/v1',
      }
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'openai/gpt-image-1',
              name: 'GPT Image 1',
              supported_parameters: {
                quality: {
                  type: 'enum',
                  values: ['auto', 'low', 'medium', 'high'],
                },
                input_references: { type: 'range', min: 0, max: 16 },
              },
            },
          ],
        }),
      } as Response)

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/ai/image/models`,
        headers: authPassHeader,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual([
        {
          id: 'openai/gpt-image-1',
          name: 'GPT Image 1',
          provider: 'openrouter',
          supported_parameters: {
            quality: {
              type: 'enum',
              values: ['auto', 'low', 'medium', 'high'],
            },
            input_references: { type: 'range', min: 0, max: 16 },
          },
        },
      ])
      expect(fetchMock).toHaveBeenCalledWith(
        'https://models-test-1.example.com/v1/images/models',
        {
          headers: { Authorization: 'Bearer test-api-key' },
          signal: expect.any(AbortSignal),
        },
      )
    })

    it('serves the cached list on a second request within the TTL without calling fetch again', async () => {
      imageConfig = {
        ...baseImageConfig(),
        endpoint: 'https://models-test-2.example.com/v1',
      }
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'openai/gpt-image-1', supported_parameters: {} }],
        }),
      } as Response)

      const first = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/ai/image/models`,
        headers: authPassHeader,
      })
      const second = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/ai/image/models`,
        headers: authPassHeader,
      })

      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      expect(second.json()).toEqual(first.json())
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
