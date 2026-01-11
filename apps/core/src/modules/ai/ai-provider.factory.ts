import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { AIProviderType, type AIProviderConfig } from './ai.types'

export function createLanguageModel(
  config: AIProviderConfig,
  modelOverride?: string,
) {
  const modelName = modelOverride || config.defaultModel

  switch (config.type) {
    case AIProviderType.OpenAI:
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.endpoint || undefined,
      })(modelName)

    case AIProviderType.OpenAICompatible:
      if (!config.endpoint) {
        throw new Error(
          `Endpoint is required for OpenAI-compatible provider: ${config.id}`,
        )
      }
      // OpenAI-compatible providers use the same createOpenAI with custom baseURL
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.endpoint,
      })(modelName)

    case AIProviderType.Anthropic:
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.endpoint || undefined,
      })(modelName)

    case AIProviderType.OpenRouter:
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.endpoint || 'https://openrouter.ai/api/v1',
      })(modelName)

    default:
      throw new Error(`Unsupported provider type: ${config.type}`)
  }
}
