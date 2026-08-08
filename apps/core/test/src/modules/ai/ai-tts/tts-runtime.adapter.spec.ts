import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  resolveTtsBaseUrl,
  TtsRuntimeAdapter,
} from '~/modules/ai/ai-tts/tts-runtime.adapter'
import { createAbortError } from '~/utils/abort.util'

const audio = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  })

afterEach(() => vi.unstubAllGlobals())

describe('resolveTtsBaseUrl', () => {
  it('maps the presets and honours a custom endpoint', () => {
    expect(resolveTtsBaseUrl('openrouter')).toBe('https://openrouter.ai/api/v1')
    expect(resolveTtsBaseUrl('openai')).toBe('https://api.openai.com/v1')
    expect(resolveTtsBaseUrl('custom', 'https://tts.local/v1/')).toBe(
      'https://tts.local/v1',
    )
  })
})

describe('TtsRuntimeAdapter', () => {
  it('posts the OpenAI speech body and returns the audio buffer', async () => {
    const fetchMock = vi.fn(async () => audio())
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'openai/tts',
    })
    const result = await adapter.generateSpeech({
      input: 'hello',
      voice: 'alloy',
      speed: 1,
    })

    expect(result.mimeType).toBe('audio/mpeg')
    expect([...result.buffer]).toEqual([1, 2, 3])

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/audio/speech')
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'openai/tts',
      input: 'hello',
      voice: 'alloy',
      speed: 1,
      response_format: 'mp3',
    })
  })

  it('applies the registered language strategy to the request body', async () => {
    const fetchMock = vi.fn(async () => audio())
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'x-ai/grok-voice-tts-1.0',
    })
    await adapter.generateSpeech({
      input: '今日',
      language: 'ja',
      voice: 'eve',
      speed: 1,
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({
      provider: { options: { xai: { language: 'ja' } } },
    })
  })

  it('retries a 500 and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(audio())
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })
    await adapter.generateSpeech({ input: 'x', voice: 'v', speed: 1 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 400', async () => {
    const fetchMock = vi.fn(
      async () => new Response('bad voice', { status: 400 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })

    await expect(
      adapter.generateSpeech({ input: 'x', voice: 'v', speed: 1 }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails fast on an aborted signal without retrying', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn(async () => {
      throw createAbortError()
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })

    await expect(
      adapter.generateSpeech({
        input: 'x',
        voice: 'v',
        speed: 1,
        signal: controller.signal,
      }),
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-audio 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'quota' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )

    const adapter = new TtsRuntimeAdapter({
      provider: 'openrouter',
      apiKey: 'k',
      model: 'm',
      retryDelayMs: 0,
    })

    await expect(
      adapter.generateSpeech({ input: 'x', voice: 'v', speed: 1 }),
    ).rejects.toThrow(/quota/)
  })
})
