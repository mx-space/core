import type { ImagesContext, ImagesModel } from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearImageCatalogCache } from '~/modules/ai/ai-image/image-catalog'
import {
  generateOpenRouterImages,
  OPENROUTER_IMAGES_API,
  type OpenRouterImagesApi,
  type OpenRouterImagesOptions,
} from '~/modules/ai/ai-image/openrouter-images-api'

function createModel(id: string): ImagesModel<OpenRouterImagesApi> {
  return {
    id,
    name: id,
    api: OPENROUTER_IMAGES_API,
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    input: ['text', 'image'],
    output: ['image'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }
}

const CATALOG_RESPONSE = {
  data: [
    {
      id: 'openai/gpt-image-1',
      supported_parameters: {
        quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high'] },
        background: {
          type: 'enum',
          values: ['auto', 'transparent', 'opaque'],
        },
        n: { type: 'range', min: 1, max: 10 },
        input_references: { type: 'range', min: 0, max: 16 },
        output_compression: { type: 'range', min: 0, max: 100 },
      },
    },
    {
      id: 'google/gemini-3-pro-image',
      supported_parameters: {
        resolution: { type: 'enum', values: ['1K', '2K', '4K'] },
        aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
        n: { type: 'range', min: 1, max: 1 },
        input_references: { type: 'range', min: 0, max: 14 },
      },
    },
  ],
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('generateOpenRouterImages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearImageCatalogCache()
  })

  it('builds the exact outbound request body, filtered by the model capability catalog', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({
          created: 1_700_000_000,
          data: [{ b64_json: 'AAAA', media_type: 'image/png' }],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 4175,
            total_tokens: 4187,
            cost: 0.04,
          },
        }),
      )

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = {
      input: [{ type: 'text', text: 'a red panda astronaut' }],
    }
    const options: OpenRouterImagesOptions = {
      apiKey: 'test-api-key',
      aspectRatio: '16:9',
      quality: 'high',
      outputFormat: 'png',
      providerParams: { moderation: 'low' },
    }

    const result = await generateOpenRouterImages(model, context, options)

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const [catalogUrl, catalogInit] = fetchMock.mock.calls[0]
    expect(catalogUrl).toBe('https://openrouter.ai/api/v1/images/models')
    expect((catalogInit as RequestInit).headers).toEqual({
      Authorization: 'Bearer test-api-key',
    })

    const [requestUrl, requestInit] = fetchMock.mock.calls[1]
    expect(requestUrl).toBe('https://openrouter.ai/api/v1/images')
    expect((requestInit as RequestInit).method).toBe('POST')
    expect((requestInit as RequestInit).headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-api-key',
    })
    expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
      model: 'openai/gpt-image-1',
      prompt: 'a red panda astronaut',
      quality: 'high',
      moderation: 'low',
    })

    expect(result.stopReason).toBe('stop')
    expect(result.output).toEqual([
      { type: 'image', data: 'AAAA', mimeType: 'image/png' },
    ])
    expect(result.usage).toMatchObject({
      input: 12,
      output: 4175,
      totalTokens: 4187,
      cost: { total: 0.04 },
    })
  })

  it('sends aspect_ratio and drops quality for a model that only supports aspect_ratio', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))

    const model = createModel('google/gemini-3-pro-image')
    const context: ImagesContext = {
      input: [{ type: 'text', text: 'a landscape' }],
    }
    const options: OpenRouterImagesOptions = {
      apiKey: 'test-api-key',
      aspectRatio: '16:9',
      quality: 'high',
    }

    await generateOpenRouterImages(model, context, options)

    const [, requestInit] = fetchMock.mock.calls[1]
    expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
      model: 'google/gemini-3-pro-image',
      prompt: 'a landscape',
      aspect_ratio: '16:9',
    })
  })

  it('wires referenceImages into input_references only when the model supports it', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = {
      input: [
        { type: 'text', text: 'edit this photo' },
        { type: 'image', data: 'ZmFrZQ==', mimeType: 'image/jpeg' },
      ],
    }

    await generateOpenRouterImages(model, context, { apiKey: 'test-api-key' })

    const [, requestInit] = fetchMock.mock.calls[1]
    expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
      model: 'openai/gpt-image-1',
      prompt: 'edit this photo',
      input_references: [
        {
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,ZmFrZQ==' },
        },
      ],
    })
  })

  it('drops reference images for a model whose supported_parameters caps input_references at 0', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 'no-references-model',
              supported_parameters: {
                input_references: { type: 'range', min: 0, max: 0 },
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [] }))

    const model = createModel('no-references-model')
    const context: ImagesContext = {
      input: [
        { type: 'text', text: 'edit this photo' },
        { type: 'image', data: 'ZmFrZQ==', mimeType: 'image/jpeg' },
      ],
    }

    await generateOpenRouterImages(model, context, { apiKey: 'test-api-key' })

    const [, requestInit] = fetchMock.mock.calls[1]
    expect(
      JSON.parse((requestInit as RequestInit).body as string),
    ).not.toHaveProperty('input_references')
  })

  it('fails closed (drops all optional params) when the capability catalog fetch fails, but still attempts generation', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ b64_json: 'CCCC', media_type: 'image/png' }] }),
      )

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }

    const result = await generateOpenRouterImages(model, context, {
      apiKey: 'test-api-key',
      aspectRatio: '16:9',
      quality: 'high',
      outputFormat: 'png',
    })

    const [, requestInit] = fetchMock.mock.calls[1]
    expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
      model: 'openai/gpt-image-1',
      prompt: 'a cat',
    })
    expect(result.stopReason).toBe('stop')
  })

  it('warns naming the model and the dropped keys when the capability catalog fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }

    try {
      await generateOpenRouterImages(model, context, {
        apiKey: 'test-api-key',
        aspectRatio: '16:9',
        quality: 'high',
      })

      const messages = warn.mock.calls.map((call) => String(call[0]))
      expect(
        messages.some((message) => message.includes('openai/gpt-image-1')),
      ).toBe(true)
      expect(
        messages.some(
          (message) =>
            message.includes('aspectRatio=16:9') &&
            message.includes('quality=high'),
        ),
      ).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })

  it('warns naming the model and the dropped key when a supported model simply lacks that parameter', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    const model = createModel('google/gemini-3-pro-image')
    const context: ImagesContext = {
      input: [{ type: 'text', text: 'a landscape' }],
    }

    try {
      await generateOpenRouterImages(model, context, {
        apiKey: 'test-api-key',
        aspectRatio: '16:9',
        quality: 'high',
      })

      const messages = warn.mock.calls.map((call) => String(call[0]))
      expect(
        messages.some(
          (message) =>
            message.includes('google/gemini-3-pro-image') &&
            message.includes('quality=high'),
        ),
      ).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })

  it('returns stopReason: error with the upstream message when the generation request fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'rate limited' } }, 429),
      )

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }
    const result = await generateOpenRouterImages(model, context, {
      apiKey: 'test-api-key',
    })

    expect(result.stopReason).toBe('error')
    expect(result.errorMessage).toBe('rate limited')
  })

  it('returns stopReason: error without calling fetch when no apiKey is provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }
    const result = await generateOpenRouterImages(model, context, {})

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.stopReason).toBe('error')
    expect(result.errorMessage).toContain('No API key')
  })

  it('does not crash on a well-formed 200 with a missing data array — output is empty, not an image', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(jsonResponse({}))

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }
    const result = await generateOpenRouterImages(model, context, {
      apiKey: 'test-api-key',
    })

    expect(result.stopReason).toBe('stop')
    expect(result.output).toEqual([])
  })

  it('drops response items with no b64_json instead of producing a broken image', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ media_type: 'image/png' }, {}] }),
      )

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }
    const result = await generateOpenRouterImages(model, context, {
      apiKey: 'test-api-key',
    })

    expect(result.stopReason).toBe('stop')
    expect(result.output).toEqual([])
  })

  it('falls back to the default mime type instead of propagating a non-string media_type', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(CATALOG_RESPONSE))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ b64_json: 'AAAA', media_type: 123 as unknown as string }],
        }),
      )

    const model = createModel('openai/gpt-image-1')
    const context: ImagesContext = { input: [{ type: 'text', text: 'a cat' }] }
    const result = await generateOpenRouterImages(model, context, {
      apiKey: 'test-api-key',
    })

    expect(result.output).toEqual([
      { type: 'image', data: 'AAAA', mimeType: 'image/png' },
    ])
  })
})
