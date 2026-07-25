import type { AssistantImages } from '@earendil-works/pi-ai'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { ImageRuntimeAdapter } from '~/modules/ai/ai-image/image-runtime.adapter'

const { generateImagesOpenRouterMock } = vi.hoisted(() => ({
  generateImagesOpenRouterMock: vi.fn(),
}))

vi.mock('@earendil-works/pi-ai/providers/images/register-builtins', () => ({
  generateImagesOpenRouter: generateImagesOpenRouterMock,
}))

function createAdapter() {
  return new ImageRuntimeAdapter({
    provider: 'openrouter',
    apiKey: 'test-api-key',
    endpoint: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3-flash-image',
  })
}

describe('ImageRuntimeAdapter.generateImage', () => {
  it('returns decoded buffers when pi reports stopReason: stop', async () => {
    const pngBytes = Buffer.from('fake-png-bytes')
    const assistantImages: AssistantImages = {
      api: 'openrouter-images',
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
    generateImagesOpenRouterMock.mockResolvedValueOnce(assistantImages)

    const adapter = createAdapter()
    const result = await adapter.generateImage({ prompt: 'a cat' })

    expect(result.images).toHaveLength(1)
    expect(result.images[0].mimeType).toBe('image/png')
    expect(result.images[0].buffer).toEqual(pngBytes)

    expect(generateImagesOpenRouterMock).toHaveBeenCalledTimes(1)
    const [model, , options] = generateImagesOpenRouterMock.mock.calls[0]
    expect(model.id).toBe('google/gemini-3-flash-image')
    expect(options.apiKey).toBe('test-api-key')
  })

  it('throws IMAGE_GENERATION_FAILED with the upstream message when pi reports stopReason: error', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [],
      stopReason: 'error',
      errorMessage: 'rate limited by upstream',
      timestamp: Date.now(),
    }
    generateImagesOpenRouterMock.mockResolvedValueOnce(assistantImages)

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

  it('throws IMAGE_GENERATION_FAILED with a synthesized message when pi reports stopReason: aborted without an errorMessage', async () => {
    const assistantImages: AssistantImages = {
      api: 'openrouter-images',
      provider: 'openrouter',
      model: 'google/gemini-3-flash-image',
      output: [],
      stopReason: 'aborted',
      timestamp: Date.now(),
    }
    generateImagesOpenRouterMock.mockResolvedValueOnce(assistantImages)

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
})
