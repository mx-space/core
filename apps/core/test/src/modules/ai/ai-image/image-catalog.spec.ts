import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchImageCatalog,
  fetchImageCatalogModel,
  resolveOpenRouterImagesBaseUrl,
} from '~/modules/ai/ai-image/image-catalog'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('resolveOpenRouterImagesBaseUrl', () => {
  it('defaults to the OpenRouter API base URL when no endpoint is given', () => {
    expect(resolveOpenRouterImagesBaseUrl()).toBe(
      'https://openrouter.ai/api/v1',
    )
    expect(resolveOpenRouterImagesBaseUrl('')).toBe(
      'https://openrouter.ai/api/v1',
    )
    expect(resolveOpenRouterImagesBaseUrl('   ')).toBe(
      'https://openrouter.ai/api/v1',
    )
  })

  it('keeps an explicitly configured endpoint', () => {
    expect(
      resolveOpenRouterImagesBaseUrl('https://custom.example.com/v1'),
    ).toBe('https://custom.example.com/v1')
  })

  it('never falls through to api.openai.com', () => {
    expect(resolveOpenRouterImagesBaseUrl(undefined)).not.toContain(
      'api.openai.com',
    )
  })
})

describe('fetchImageCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses id + supported_parameters for each model, dropping unrecognized descriptor shapes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: 'openai/gpt-image-1',
            supported_parameters: {
              quality: {
                type: 'enum',
                values: ['auto', 'low', 'medium', 'high'],
              },
              n: { type: 'range', min: 1, max: 10 },
              seed: { type: 'boolean' },
              bogus: { type: 'unknown-descriptor-type' },
              malformed_range: { type: 'range', min: 'x', max: 10 },
            },
          },
          { id: 'no-supported-parameters-field' },
          { missingId: true },
        ],
      }),
    )

    const models = await fetchImageCatalog({ apiKey: 'test-api-key' })

    expect(models).toEqual([
      {
        id: 'openai/gpt-image-1',
        supportedParameters: {
          quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high'] },
          n: { type: 'range', min: 1, max: 10 },
          seed: { type: 'boolean' },
        },
      },
      { id: 'no-supported-parameters-field', supportedParameters: {} },
    ])
  })

  it('sends the resolved base URL and bearer auth header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: [] }))

    await fetchImageCatalog({
      endpoint: 'https://custom.example.com/v1',
      apiKey: 'test-api-key',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.example.com/v1/images/models',
      { headers: { Authorization: 'Bearer test-api-key' } },
    )
  })

  it('omits the Authorization header when no apiKey is given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: [] }))

    await fetchImageCatalog({})

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/images/models',
      { headers: {} },
    )
  })

  it('throws when the catalog response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}, 500))

    await expect(fetchImageCatalog({})).rejects.toThrow(/500/)
  })

  it('returns an empty list when data is missing or not an array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({}))
    expect(await fetchImageCatalog({})).toEqual([])
  })
})

describe('fetchImageCatalogModel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('finds the model by id from the fetched catalog', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        data: [
          { id: 'openai/gpt-image-1', supported_parameters: {} },
          {
            id: 'google/gemini-3-pro-image',
            supported_parameters: {
              aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
            },
          },
        ],
      }),
    )

    const model = await fetchImageCatalogModel({}, 'google/gemini-3-pro-image')

    expect(model).toEqual({
      id: 'google/gemini-3-pro-image',
      supportedParameters: {
        aspect_ratio: { type: 'enum', values: ['1:1', '16:9'] },
      },
    })
  })

  it('returns undefined when the model id is not in the catalog', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ data: [] }),
    )

    expect(await fetchImageCatalogModel({}, 'unknown/model')).toBeUndefined()
  })
})
