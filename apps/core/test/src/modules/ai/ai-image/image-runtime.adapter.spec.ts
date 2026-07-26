import type { AssistantImages } from '@earendil-works/pi-ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { ImageRuntimeAdapter } from '~/modules/ai/ai-image/image-runtime.adapter'

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

function createAdapter() {
  return new ImageRuntimeAdapter({
    provider: 'openrouter',
    apiKey: 'test-api-key',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3-flash-image',
  })
}

describe('ImageRuntimeAdapter.generateImage', () => {
  beforeEach(() => {
    generateOpenRouterImagesMock.mockReset()
  })

  it('returns decoded buffers when the OpenRouter transport reports stopReason: stop', async () => {
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

    const adapter = createAdapter()
    const result = await adapter.generateImage({ prompt: 'a cat' })

    expect(result.images).toHaveLength(1)
    expect(result.images[0].mimeType).toBe('image/png')
    expect(result.images[0].buffer).toEqual(pngBytes)

    expect(generateOpenRouterImagesMock).toHaveBeenCalledTimes(1)
    const [model, , options] = generateOpenRouterImagesMock.mock.calls[0]
    expect(model.id).toBe('google/gemini-3-flash-image')
    expect(options.apiKey).toBe('test-api-key')
  })

  it('drops a non-string data field instead of crashing or returning a corrupt buffer', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [
        {
          type: 'image',
          data: 123 as unknown as string,
          mimeType: 'image/png',
        },
        {
          type: 'image',
          data: ['a'] as unknown as string,
          mimeType: 'image/png',
        },
      ],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    const adapter = createAdapter()
    const result = await adapter.generateImage({ prompt: 'a cat' })

    expect(result.images).toEqual([])
  })

  it('drops a base64 string that decodes to zero bytes instead of returning an empty-file image', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [{ type: 'image', data: '!!!', mimeType: 'image/png' }],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    const adapter = createAdapter()
    const result = await adapter.generateImage({ prompt: 'a cat' })

    expect(result.images).toEqual([])
  })

  it('keeps valid images while dropping malformed ones from the same response', async () => {
    const pngBytes = Buffer.from('fake-png-bytes')
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [
        {
          type: 'image',
          data: 123 as unknown as string,
          mimeType: 'image/png',
        },
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

    const adapter = createAdapter()
    const result = await adapter.generateImage({ prompt: 'a cat' })

    expect(result.images).toHaveLength(1)
    expect(result.images[0].buffer).toEqual(pngBytes)
  })

  it('throws IMAGE_GENERATION_FAILED with the upstream message when the transport reports stopReason: error', async () => {
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

    const adapter = createAdapter()

    let caught: unknown
    try {
      await adapter.generateImage({ prompt: 'a cat' })
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      code: AppErrorCode.IMAGE_GENERATION_FAILED,
      message: 'rate limited by upstream',
    })
  })

  it('resolves baseUrl to the OpenRouter default when endpoint is blank', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'openai/gpt-image-1',
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

    const adapter = new ImageRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'test-api-key',
      endpoint: '',
      model: 'openai/gpt-image-1',
    })
    await adapter.generateImage({ prompt: 'a cat' })

    const [model] = generateOpenRouterImagesMock.mock.calls[0]
    expect(model.baseUrl).toBe('https://openrouter.ai/api/v1')
  })

  it('never falls through to the OpenAI default base URL, even for an unrecognized provider id', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'not-a-real-provider',
      model: 'whatever',
      output: [],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    const adapter = new ImageRuntimeAdapter({
      provider: 'not-a-real-provider',
      apiKey: 'test-api-key',
      endpoint: '',
      model: 'whatever',
    })
    await adapter.generateImage({ prompt: 'a cat' })

    const [model] = generateOpenRouterImagesMock.mock.calls[0]
    expect(model.baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(model.baseUrl).not.toContain('api.openai.com')
  })

  it('keeps an explicitly configured endpoint over the OpenRouter default', async () => {
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

    const adapter = new ImageRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'test-api-key',
      endpoint: 'https://custom.example.com/v1',
      model: 'google/gemini-3-flash-image',
    })
    await adapter.generateImage({ prompt: 'a cat' })

    const [model] = generateOpenRouterImagesMock.mock.calls[0]
    expect(model.baseUrl).toBe('https://custom.example.com/v1')
  })

  it('throws IMAGE_GENERATION_FAILED with a synthesized message when the transport reports stopReason: aborted without an errorMessage', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [],
      stopReason: 'aborted',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    const adapter = createAdapter()

    let caught: unknown
    try {
      await adapter.generateImage({ prompt: 'a cat' })
    } catch (error) {
      caught = error
    }

    expect(caught).toMatchObject({
      code: AppErrorCode.IMAGE_GENERATION_FAILED,
      message: 'image generation ended with stopReason "aborted"',
    })
  })

  it('passes the neutral options through to the transport for capability filtering', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images-api',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [],
      stopReason: 'stop',
      timestamp: Date.now(),
    }
    generateOpenRouterImagesMock.mockResolvedValueOnce(assistantImages)

    const adapter = createAdapter()
    await adapter.generateImage({
      prompt: 'a cat',
      aspectRatio: '16:9',
      quality: 'high',
      format: 'png',
      providerParams: { moderation: 'low' },
    })

    const [, context, options] = generateOpenRouterImagesMock.mock.calls[0]
    expect(context.input).toEqual([{ type: 'text', text: 'a cat' }])
    expect(options).toMatchObject({
      aspectRatio: '16:9',
      quality: 'high',
      outputFormat: 'png',
      providerParams: { moderation: 'low' },
    })
  })
})
