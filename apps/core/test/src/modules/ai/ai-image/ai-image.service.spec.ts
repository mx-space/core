import type { AssistantImages } from '@earendil-works/pi-ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
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

function createService(configOverrides: Record<string, unknown> = {}) {
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
  )
  service.onModuleInit()

  return {
    service,
    fileService,
    taskProcessor,
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
})
