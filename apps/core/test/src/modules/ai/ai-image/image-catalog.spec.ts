import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearImageCatalogCache,
  fetchImageCatalog,
  getImageCatalog,
  getImageCatalogModel,
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

  it('parses id + name (falling back to id when absent) + supported_parameters, dropping unrecognized descriptor shapes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: 'openai/gpt-image-1',
            name: 'GPT Image 1',
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
        name: 'GPT Image 1',
        supportedParameters: {
          quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high'] },
          n: { type: 'range', min: 1, max: 10 },
          seed: { type: 'boolean' },
        },
      },
      {
        id: 'no-supported-parameters-field',
        name: 'no-supported-parameters-field',
        supportedParameters: {},
      },
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

describe('getImageCatalog (shared cache)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    clearImageCatalogCache()
  })

  it('serves a fresh cache entry without calling fetch again', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm1', supported_parameters: {} }] }),
      )
    const config = { endpoint: 'https://cache-test-fresh.example.com/v1' }

    const first = await getImageCatalog(config)
    const second = await getImageCatalog(config)

    expect(first).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('serves a stale entry immediately, then refreshes it in the background', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm1', supported_parameters: {} }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm2', supported_parameters: {} }] }),
      )
    const config = { endpoint: 'https://cache-test-stale.example.com/v1' }

    const first = await getImageCatalog(config)
    expect(first).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1)

    const second = await getImageCatalog(config)
    expect(second).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])

    await vi.advanceTimersByTimeAsync(0)

    const third = await getImageCatalog(config)
    expect(third).toEqual([{ id: 'm2', name: 'm2', supportedParameters: {} }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resets the refreshing flag on a failed background refresh so a later request can retry', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm1', supported_parameters: {} }] }),
      )
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm2', supported_parameters: {} }] }),
      )
    const config = { endpoint: 'https://cache-test-retry.example.com/v1' }

    const first = await getImageCatalog(config)
    expect(first).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1)
    const second = await getImageCatalog(config)
    expect(second).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])

    // Let the failed background refresh settle; it must reset `refreshing`
    // rather than leaving the entry permanently stale-locked.
    await vi.advanceTimersByTimeAsync(0)

    const third = await getImageCatalog(config)
    expect(third).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])

    await vi.advanceTimersByTimeAsync(0)

    const fourth = await getImageCatalog(config)
    expect(fourth).toEqual([{ id: 'm2', name: 'm2', supportedParameters: {} }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('keys the cache by resolved base URL, not by an opaque provider id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm1', supported_parameters: {} }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'm2', supported_parameters: {} }] }),
      )

    const first = await getImageCatalog({
      endpoint: 'https://cache-test-key-a.example.com/v1',
    })
    const second = await getImageCatalog({
      endpoint: 'https://cache-test-key-b.example.com/v1',
    })

    expect(first).toEqual([{ id: 'm1', name: 'm1', supportedParameters: {} }])
    expect(second).toEqual([{ id: 'm2', name: 'm2', supportedParameters: {} }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('getImageCatalogModel (shared cache)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    clearImageCatalogCache()
  })

  it('finds the model by id via the cached catalog', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        data: [{ id: 'openai/gpt-image-1', supported_parameters: {} }],
      }),
    )
    const config = { endpoint: 'https://cache-test-model.example.com/v1' }

    const first = await getImageCatalogModel(config, 'openai/gpt-image-1')
    const second = await getImageCatalogModel(config, 'openai/gpt-image-1')

    expect(first).toEqual({
      id: 'openai/gpt-image-1',
      name: 'openai/gpt-image-1',
      supportedParameters: {},
    })
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
