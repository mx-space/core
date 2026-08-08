import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { type AIProviderConfig, AIProviderType } from '~/modules/ai/ai.types'
import {
  discoverTtsVoices,
  TtsVoiceCatalogService,
} from '~/modules/ai/ai-tts/tts-voice-catalog.service'

const provider: AIProviderConfig = {
  id: 'speech-provider',
  name: 'Speech Provider',
  type: AIProviderType.OpenAICompatible,
  apiKey: 'secret',
  endpoint: 'https://api.example.com/v1',
  defaultModel: '',
  enabled: true,
  capabilities: { text: false, image: false, speech: true },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('discoverTtsVoices', () => {
  it('returns the built-in OpenAI voice catalog without a network request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverTtsVoices(
      provider,
      'openai/gpt-4o-mini-tts-2025-12-15',
    )

    expect(result).toMatchObject({
      manualInputAllowed: true,
      source: 'builtin',
    })
    expect(result.voices.map((voice) => voice.id)).toEqual(
      expect.arrayContaining(['alloy', 'nova', 'shimmer', 'cedar']),
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes a configured remote voice catalog', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'voice_123',
              name: 'Narrator',
              preview_url: 'https://cdn.example.com/voice.mp3',
            },
            { voice_id: 'VOICE_123', label: 'Duplicate' },
            'provider-default',
            { invalid: true },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await discoverTtsVoices(
      {
        ...provider,
        voiceListUrl: 'https://api.example.com/v1/audio/voices',
      },
      'provider/tts-model',
    )

    expect(result).toEqual({
      manualInputAllowed: true,
      source: 'remote',
      voices: [
        {
          id: 'voice_123',
          kind: 'provider',
          name: 'Narrator',
          previewUrl: 'https://cdn.example.com/voice.mp3',
        },
        {
          id: 'provider-default',
          kind: 'provider',
          name: 'provider-default',
        },
      ],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.example.com/v1/audio/voices'),
      expect.objectContaining({
        headers: {
          accept: 'application/json',
          authorization: 'Bearer secret',
        },
      }),
    )
  })

  it('falls back to built-in voices when remote discovery fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })),
    )

    const result = await discoverTtsVoices(
      {
        ...provider,
        voiceListUrl: 'https://api.example.com/v1/audio/voices',
      },
      'gpt-4o-mini-tts',
    )

    expect(result.source).toBe('builtin')
    expect(result.voices).not.toHaveLength(0)
    expect(result.error).toContain('status 503')
  })

  it('returns an empty discoverable catalog while preserving manual input', async () => {
    await expect(
      discoverTtsVoices(provider, 'provider/unknown'),
    ).resolves.toEqual({
      manualInputAllowed: true,
      source: 'none',
      voices: [],
    })
  })
})

describe('TtsVoiceCatalogService', () => {
  it('rejects discovery when the capability route cannot resolve its provider', async () => {
    const configsService = {
      resolveAiProviderForCapability: vi.fn().mockResolvedValue(null),
    }
    const service = new TtsVoiceCatalogService(configsService as any)

    await expect(
      service.discover({ providerId: 'missing', model: 'tts-model' }),
    ).rejects.toMatchObject({ code: AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED })
  })
})
