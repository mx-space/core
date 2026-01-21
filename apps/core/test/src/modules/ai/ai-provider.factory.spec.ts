import { createLanguageModel } from '~/modules/ai/ai-provider.factory'
import { AIProviderType } from '~/modules/ai/ai.types'
import { describe, expect, it, vi } from 'vitest'

// Mock the SDK providers
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((config: { apiKey: string; baseURL?: string }) => {
    const provider = ((model: string) => ({
      id: `openai:${model}`,
      config,
    })) as any

    // The real SDK provider exposes typed helpers like `.chat(...)`.
    provider.chat = (model: string) => ({
      id: `openai.chat:${model}`,
      config,
    })

    return provider
  }),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(
    (config: { apiKey: string; baseURL?: string }) => (model: string) => ({
      id: `anthropic:${model}`,
      config,
    }),
  ),
}))

describe('createLanguageModel', () => {
  it('should create OpenAI model', () => {
    const config = {
      id: 'test',
      name: 'Test',
      type: AIProviderType.OpenAI,
      apiKey: 'sk-xxx',
      defaultModel: 'gpt-4o',
      enabled: true,
    }
    const model = createLanguageModel(config) as any
    expect(model).toBeDefined()
    expect(model.id).toBe('openai:gpt-4o')
  })

  it('should create OpenAI model with custom endpoint', () => {
    const config = {
      id: 'test',
      name: 'Test',
      type: AIProviderType.OpenAI,
      apiKey: 'sk-xxx',
      endpoint: 'https://custom.openai.com',
      defaultModel: 'gpt-4o',
      enabled: true,
    }
    const model = createLanguageModel(config) as any
    expect(model).toBeDefined()
    expect(model.config.baseURL).toBe('https://custom.openai.com')
  })

  it('should create OpenAI-compatible model with endpoint', () => {
    const config = {
      id: 'deepseek',
      name: 'DeepSeek',
      type: AIProviderType.OpenAICompatible,
      apiKey: 'sk-xxx',
      endpoint: 'https://api.deepseek.com',
      defaultModel: 'deepseek-chat',
      enabled: true,
    }
    const model = createLanguageModel(config) as any
    expect(model).toBeDefined()
    expect(model.id).toBe('openai.chat:deepseek-chat')
    expect(model.config.baseURL).toBe('https://api.deepseek.com')
  })

  it('should throw error for OpenAI-compatible without endpoint', () => {
    const config = {
      id: 'deepseek',
      name: 'DeepSeek',
      type: AIProviderType.OpenAICompatible,
      apiKey: 'sk-xxx',
      defaultModel: 'deepseek-chat',
      enabled: true,
    }
    expect(() => createLanguageModel(config)).toThrow(
      'Endpoint is required for OpenAI-compatible provider',
    )
  })

  it('should create Anthropic model', () => {
    const config = {
      id: 'claude',
      name: 'Claude',
      type: AIProviderType.Anthropic,
      apiKey: 'sk-ant-xxx',
      defaultModel: 'claude-sonnet-4-20250514',
      enabled: true,
    }
    const model = createLanguageModel(config) as any
    expect(model).toBeDefined()
    expect(model.id).toBe('anthropic:claude-sonnet-4-20250514')
  })

  it('should use model override when provided', () => {
    const config = {
      id: 'test',
      name: 'Test',
      type: AIProviderType.OpenAI,
      apiKey: 'sk-xxx',
      defaultModel: 'gpt-4o',
      enabled: true,
    }
    const model = createLanguageModel(config, 'gpt-4o-mini') as any
    expect(model.id).toBe('openai:gpt-4o-mini')
  })

  it('should throw error for unsupported provider type', () => {
    const config = {
      id: 'unknown',
      name: 'Unknown',
      type: 'unknown' as AIProviderType,
      apiKey: 'sk-xxx',
      defaultModel: 'model',
      enabled: true,
    }
    expect(() => createLanguageModel(config)).toThrow(
      'Unsupported provider type',
    )
  })
})
