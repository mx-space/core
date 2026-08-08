import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  aiProviderPresets,
  createProviderFromPreset,
  findAIProviderPreset,
  groupAIProviderPresets,
} from './aiProviderPresets'

describe('createProviderFromPreset', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fills connection fields and leaves apiKey empty', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'provider-uuid',
    })

    const deepseek = aiProviderPresets.find(
      (preset) => preset.id === 'deepseek',
    )
    expect(deepseek).toBeDefined()

    const provider = createProviderFromPreset(deepseek!)
    expect(provider).toEqual({
      apiKey: '',
      appendV1: true,
      capabilities: { image: false, speech: false, text: true },
      defaultModel: 'deepseek-chat',
      enabled: true,
      endpoint: 'https://api.deepseek.com',
      id: 'provider-uuid',
      modelListUrl: undefined,
      name: 'DeepSeek',
      type: 'openai-compatible',
    })
  })

  it('uses empty name for the custom preset', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'custom-uuid',
    })

    const custom = aiProviderPresets.find((preset) => preset.id === 'custom')
    const provider = createProviderFromPreset(custom!)
    expect(provider.id).toBe('custom-uuid')
    expect(provider.name).toBe('')
    expect(provider.endpoint).toBeUndefined()
    expect(provider.type).toBe('openai-compatible')
  })
})

describe('findAIProviderPreset', () => {
  it('matches by normalized endpoint', () => {
    const preset = findAIProviderPreset({
      endpoint: 'https://api.deepseek.com/',
      name: '',
      type: 'openai-compatible',
    })
    expect(preset?.id).toBe('deepseek')
  })

  it('falls back to name + type', () => {
    const preset = findAIProviderPreset({
      name: 'Anthropic',
      type: 'anthropic',
    })
    expect(preset?.id).toBe('anthropic')
  })
})

describe('groupAIProviderPresets', () => {
  it('returns non-empty category groups in stable order', () => {
    const groups = groupAIProviderPresets()
    expect(groups.map((group) => group.category)).toEqual([
      'official',
      'cn_official',
      'aggregator',
      'custom',
    ])
    expect(groups.every((group) => group.presets.length > 0)).toBe(true)
  })
})
