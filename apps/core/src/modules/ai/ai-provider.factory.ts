import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
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

    case AIProviderType.OpenAICompatible: {
      if (!config.endpoint) {
        throw new Error(
          `Endpoint is required for OpenAI-compatible provider: ${config.id}`,
        )
      }
      // OpenAI-compatible providers: create a custom provider instance.
      // Many "OpenAI-compatible" gateways don't fully support the SDK's automatic
      // API selection (responses/chat/completions). Force chat models to avoid
      // mismatches on these providers.
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.endpoint,
      })
      return openai.chat(modelName)
    }

    case AIProviderType.Anthropic:
      return createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.endpoint || undefined,
      })(modelName)

    case AIProviderType.OpenRouter:
      return createOpenRouter({
        apiKey: config.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      })(modelName)

    default:
      throw new Error(`Unsupported provider type: ${config.type}`)
  }
}
