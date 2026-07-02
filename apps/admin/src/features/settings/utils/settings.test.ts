import { describe, expect, it } from 'vitest'

import {
  coerceAIProviderType,
  matchRegistryModel,
  mergeModelOptions,
  resolvePiProviderId,
} from './settings'

describe('mergeModelOptions', () => {
  it('keeps fetched models first and de-duplicates case-insensitively', () => {
    expect(
      mergeModelOptions(
        [{ id: 'gemini-2.5-pro' }, { id: 'gemini-2.5-flash' }],
        [{ id: 'GEMINI-2.5-PRO' }, { id: 'gpt-4o' }],
      ),
    ).toEqual(['gemini-2.5-pro', 'gemini-2.5-flash', 'gpt-4o'])
  })

  it('handles missing inputs', () => {
    expect(mergeModelOptions(undefined, [{ id: 'gpt-4o' }])).toEqual(['gpt-4o'])
    expect(mergeModelOptions([], undefined)).toEqual([])
  })
})

describe('resolvePiProviderId', () => {
  it('maps known hostnames to registry provider ids', () => {
    expect(
      resolvePiProviderId({
        endpoint: 'https://api.openai.com/v1',
        type: 'openai-compatible',
      }),
    ).toBe('openai')
    expect(
      resolvePiProviderId({
        endpoint: 'https://api.anthropic.com',
        type: 'anthropic',
      }),
    ).toBe('anthropic')
    expect(
      resolvePiProviderId({
        endpoint: 'https://openrouter.ai/api/v1',
        type: 'openai-compatible',
      }),
    ).toBe('openrouter')
    expect(
      resolvePiProviderId({
        endpoint: 'https://api.deepseek.com',
        type: 'openai-compatible',
      }),
    ).toBe('deepseek')
  })

  it('falls back by type when hostname is unknown', () => {
    expect(
      resolvePiProviderId({
        endpoint: 'https://my-internal.example.com',
        type: 'openai-compatible',
      }),
    ).toBe('openai')
    expect(
      resolvePiProviderId({
        endpoint: 'https://example.com',
        type: 'anthropic',
      }),
    ).toBe('anthropic')
  })

  it('returns null for empty endpoint + generic', () => {
    expect(resolvePiProviderId({ endpoint: '', type: 'generic' })).toBeNull()
    expect(
      resolvePiProviderId({ endpoint: undefined, type: 'generic' }),
    ).toBeNull()
  })

  it('falls back by type for openai-compatible/anthropic when endpoint is empty', () => {
    expect(
      resolvePiProviderId({ endpoint: '', type: 'openai-compatible' }),
    ).toBe('openai')
    expect(resolvePiProviderId({ endpoint: '', type: 'anthropic' })).toBe(
      'anthropic',
    )
  })

  it('falls back by type when endpoint is not a valid URL', () => {
    expect(
      resolvePiProviderId({ endpoint: 'not a url', type: 'anthropic' }),
    ).toBe('anthropic')
  })
})

describe('matchRegistryModel', () => {
  const models = [
    { id: 'gpt-4o' },
    { id: 'claude-sonnet-4.5' },
    { id: 'deepseek-chat' },
  ]

  it('matches case-insensitively', () => {
    expect(matchRegistryModel(models, 'gpt-4O')).toEqual({ id: 'gpt-4o' })
    expect(matchRegistryModel(models, 'GPT-4O')).toEqual({ id: 'gpt-4o' })
    expect(matchRegistryModel(models, 'gpt-4o')).toEqual({ id: 'gpt-4o' })
  })

  it('trims whitespace around the input', () => {
    expect(matchRegistryModel(models, '  gpt-4o  ')).toEqual({ id: 'gpt-4o' })
  })

  it('returns undefined when the model is not in the registry', () => {
    expect(matchRegistryModel(models, 'gpt-5-preview')).toBeUndefined()
    expect(matchRegistryModel(models, '')).toBeUndefined()
  })

  it('handles missing registry list', () => {
    expect(matchRegistryModel(undefined, 'gpt-4o')).toBeUndefined()
    expect(matchRegistryModel([], 'gpt-4o')).toBeUndefined()
  })
})

describe('coerceAIProviderType', () => {
  it('keeps the 3 allowed values intact', () => {
    expect(coerceAIProviderType('openai-compatible')).toBe('openai-compatible')
    expect(coerceAIProviderType('anthropic')).toBe('anthropic')
    expect(coerceAIProviderType('generic')).toBe('generic')
  })

  it('maps legacy openai/openrouter to openai-compatible', () => {
    expect(coerceAIProviderType('openai')).toBe('openai-compatible')
    expect(coerceAIProviderType('openrouter')).toBe('openai-compatible')
  })

  it('maps unknown values to openai-compatible', () => {
    expect(coerceAIProviderType('something-else')).toBe('openai-compatible')
    expect(coerceAIProviderType(undefined)).toBe('openai-compatible')
    expect(coerceAIProviderType(null)).toBe('openai-compatible')
  })
})

// Cross-cuts the "5 known providers + 1 custom" + case-insensitive contract
// from the step-19 success criterion. We assert that token-field visibility
// (= "model NOT in registry") follows the same matchRegistryModel rule across
// every fixture without re-mounting the Combobox UI.
describe('contextWindow/maxTokens visibility rule across 6 providers', () => {
  const cases: Array<{
    label: string
    models: { id: string }[]
    modelId: string
    expectMatch: boolean
  }> = [
    {
      label: 'openai gpt-4o (case-mixed)',
      models: [{ id: 'gpt-4o' }],
      modelId: 'gpt-4O',
      expectMatch: true,
    },
    {
      label: 'anthropic claude-sonnet-4.5',
      models: [{ id: 'claude-sonnet-4.5' }],
      modelId: 'Claude-Sonnet-4.5',
      expectMatch: true,
    },
    {
      label: 'deepseek deepseek-chat',
      models: [{ id: 'deepseek-chat' }],
      modelId: 'DeepSeek-Chat',
      expectMatch: true,
    },
    {
      label: 'openrouter passthrough id',
      models: [{ id: 'anthropic/claude-sonnet-4.5' }],
      modelId: 'anthropic/claude-sonnet-4.5',
      expectMatch: true,
    },
    {
      label: 'openai gpt-5-preview missing from registry',
      models: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
      modelId: 'gpt-5-preview',
      expectMatch: false,
    },
    {
      label: 'generic custom id, no registry entries',
      models: [],
      modelId: 'my-finetune-v1',
      expectMatch: false,
    },
  ]

  for (const c of cases) {
    it(`${c.label} -> ${c.expectMatch ? 'hides' : 'shows'} token fields`, () => {
      const match = matchRegistryModel(c.models, c.modelId)
      const showCustom = c.modelId.trim().length > 0 && !match
      expect(Boolean(match)).toBe(c.expectMatch)
      expect(showCustom).toBe(!c.expectMatch)
    })
  }
})
