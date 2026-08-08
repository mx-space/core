import { describe, expect, it } from 'vitest'

import {
  defaultTtsLanguageStrategyRegistry,
  TtsLanguageStrategyRegistry,
} from '~/modules/ai/ai-tts/tts-language-strategy'

const openRouterContext = {
  baseUrl: 'https://openrouter.ai/api/v1',
  language: 'ja',
}

describe('TtsLanguageStrategyRegistry', () => {
  it('resolves a newly registered strategy', () => {
    const registry = new TtsLanguageStrategyRegistry().register({
      id: 'custom-language',
      version: 2,
      matches: ({ model }) => model === 'custom/tts',
      buildRequestParams: ({ language }) => ({ language }),
    })

    expect(
      registry.resolve({
        ...openRouterContext,
        model: 'custom/tts',
      }),
    ).toEqual({
      cacheKey: 'custom-language:v2:ja',
      requestParams: { language: 'ja' },
      strategyId: 'custom-language',
    })
  })

  it('rejects duplicate strategy ids', () => {
    const registry = new TtsLanguageStrategyRegistry()
    const strategy = {
      id: 'duplicate',
      version: 1,
      matches: () => true,
      buildRequestParams: () => ({}),
    }
    registry.register(strategy)

    expect(() => registry.register(strategy)).toThrow(
      'duplicate TTS language strategy: duplicate',
    )
  })

  it('falls back without adding unverified request parameters', () => {
    expect(
      defaultTtsLanguageStrategyRegistry.resolve({
        ...openRouterContext,
        model: 'unknown/speech',
      }),
    ).toEqual({
      cacheKey: 'auto:v1',
      requestParams: {},
      strategyId: 'auto',
    })
  })
})

describe('default TTS language strategies', () => {
  it('steers Gemini through its transcript prompt and selects PCM output', () => {
    const japanese = defaultTtsLanguageStrategyRegistry.resolve({
      ...openRouterContext,
      model: 'google/gemini-3.1-flash-tts-preview',
    })
    const chinese = defaultTtsLanguageStrategyRegistry.resolve({
      ...openRouterContext,
      language: 'zh',
      model: 'google/gemini-3.1-flash-tts-preview',
    })

    expect(japanese).toMatchObject({
      audioFormat: 'wav',
      responseFormat: 'pcm',
      strategyId: 'openrouter-google-gemini-prompt',
    })
    expect(japanese.transformInput?.('今日')).toMatch(
      /Japanese \(ja-JP\).*Transcript:\n今日/s,
    )
    expect(chinese.transformInput?.('今日')).toMatch(
      /Mandarin Chinese \(zh-CN\).*Transcript:\n今日/s,
    )
  })

  it('passes an explicit language to xAI through OpenRouter', () => {
    const resolved = defaultTtsLanguageStrategyRegistry.resolve({
      ...openRouterContext,
      model: 'x-ai/grok-voice-tts-1.0',
    })

    expect(resolved.requestParams).toEqual({
      provider: { options: { xai: { language: 'ja' } } },
    })
    expect(resolved.cacheKey).toContain('openrouter-xai-language')
  })

  it('maps the language to MiniMax language_boost', () => {
    const resolved = defaultTtsLanguageStrategyRegistry.resolve({
      ...openRouterContext,
      model: 'minimax/speech-2.8-turbo',
    })

    expect(resolved.requestParams).toEqual({
      provider: { options: { minimax: { language_boost: 'Japanese' } } },
    })
  })

  it('adds language instructions for OpenAI speech models on OpenRouter', () => {
    const resolved = defaultTtsLanguageStrategyRegistry.resolve({
      ...openRouterContext,
      model: 'openai/gpt-4o-mini-tts-2025-12-15',
    })

    expect(resolved.requestParams).toEqual({
      provider: {
        options: {
          openai: {
            instructions: expect.stringMatching(/Japanese.*ja/),
          },
        },
      },
    })
  })

  it('adds top-level instructions for the native OpenAI speech endpoint', () => {
    const resolved = defaultTtsLanguageStrategyRegistry.resolve({
      baseUrl: 'https://api.openai.com/v1',
      language: 'ja',
      model: 'gpt-4o-mini-tts',
    })

    expect(resolved.requestParams).toEqual({
      instructions: expect.stringMatching(/Japanese.*ja/),
    })
  })

  it('does not send unsupported instructions to legacy OpenAI TTS models', () => {
    expect(
      defaultTtsLanguageStrategyRegistry.resolve({
        baseUrl: 'https://api.openai.com/v1',
        language: 'ja',
        model: 'tts-1-hd',
      }).requestParams,
    ).toEqual({})
  })
})
