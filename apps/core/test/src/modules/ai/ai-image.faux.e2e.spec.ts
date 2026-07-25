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
import { AiService } from '~/modules/ai/ai.service'
import { AIProviderType } from '~/modules/ai/ai.types'
import { AiImageController } from '~/modules/ai/ai-image/ai-image.controller'
import { AiImageService } from '~/modules/ai/ai-image/ai-image.service'
import { AiTaskService } from '~/modules/ai/ai-task/ai-task.service'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'
import { ConfigsService } from '~/modules/configs/configs.service'
import { DatabaseService } from '~/processors/database/database.service'
import type { TaskExecuteContext } from '~/processors/task-queue'
import { TaskQueueService } from '~/processors/task-queue'

const { generateImagesOpenRouterMock } = vi.hoisted(() => ({
  generateImagesOpenRouterMock: vi.fn(),
}))

vi.mock('@earendil-works/pi-ai/providers/images/register-builtins', () => ({
  generateImagesOpenRouter: generateImagesOpenRouterMock,
}))

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
    generateImagesOpenRouterMock.mockReset()
    vi.clearAllMocks()
  })

  afterEach(() => {
    while (torn.length) torn.pop()!()
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
    expect(generateImagesOpenRouterMock).not.toHaveBeenCalled()
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
      api: 'openrouter-images',
      provider: 'openrouter',
      model: baseImageConfig().model,
      output: [],
      stopReason: 'error',
      errorMessage: 'rate limited by upstream',
      timestamp: Date.now(),
    }
    generateImagesOpenRouterMock.mockResolvedValueOnce(assistantImages)

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
})
