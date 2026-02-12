import { AIProviderType } from '~/modules/ai/ai.types'
import { createModelRuntime } from '~/modules/ai/runtime'
import { describe, expect, it, vi } from 'vitest'

// Mock the SDK providers
vi.mock('openai', () => ({
  default: class MockOpenAI {
    apiKey: string
    baseURL?: string
    constructor(config: { apiKey: string; baseURL?: string }) {
      this.apiKey = config.apiKey
      this.baseURL = config.baseURL
    }
  },
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    apiKey: string
    baseURL?: string
    constructor(config: { apiKey: string; baseURL?: string }) {
      this.apiKey = config.apiKey
      this.baseURL = config.baseURL
    }
  },
}))

describe('createModelRuntime', () => {
  it('should create OpenAI runtime', () => {
    const config = {
      id: 'test',
      name: 'Test',
      type: AIProviderType.OpenAI,
      apiKey: 'sk-xxx',
      defaultModel: 'gpt-4o',
      enabled: true,
    }
    const runtime = createModelRuntime(config)
    expect(runtime).toBeDefined()
    expect(runtime.providerInfo.type).toBe(AIProviderType.OpenAI)
    expect(runtime.providerInfo.model).toBe('gpt-4o')
  })

  it('should create OpenAI runtime with custom endpoint', () => {
    const config = {
      id: 'test',
      name: 'Test',
      type: AIProviderType.OpenAI,
      apiKey: 'sk-xxx',
      endpoint: 'https://custom.openai.com',
      defaultModel: 'gpt-4o',
      enabled: true,
    }
    const runtime = createModelRuntime(config)
    expect(runtime).toBeDefined()
    expect(runtime.providerInfo.type).toBe(AIProviderType.OpenAI)
  })

  it('should create OpenAI-compatible runtime with endpoint', () => {
    const config = {
      id: 'deepseek',
      name: 'DeepSeek',
      type: AIProviderType.OpenAICompatible,
      apiKey: 'sk-xxx',
      endpoint: 'https://api.deepseek.com',
      defaultModel: 'deepseek-chat',
      enabled: true,
    }
    const runtime = createModelRuntime(config)
    expect(runtime).toBeDefined()
    expect(runtime.providerInfo.type).toBe(AIProviderType.OpenAICompatible)
    expect(runtime.providerInfo.model).toBe('deepseek-chat')
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
    expect(() => createModelRuntime(config)).toThrow(
      'Endpoint is required for OpenAI-compatible provider',
    )
  })

  it('should create Anthropic runtime', () => {
    const config = {
      id: 'claude',
      name: 'Claude',
      type: AIProviderType.Anthropic,
      apiKey: 'sk-ant-xxx',
      defaultModel: 'claude-sonnet-4-20250514',
      enabled: true,
    }
    const runtime = createModelRuntime(config)
    expect(runtime).toBeDefined()
    expect(runtime.providerInfo.type).toBe(AIProviderType.Anthropic)
    expect(runtime.providerInfo.model).toBe('claude-sonnet-4-20250514')
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
    const runtime = createModelRuntime(config, 'gpt-4o-mini')
    expect(runtime.providerInfo.model).toBe('gpt-4o-mini')
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
    expect(() => createModelRuntime(config)).toThrow(
      'Unsupported provider type',
    )
  })
})
