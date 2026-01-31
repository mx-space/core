import type { AIProviderConfig } from '../ai.types'
import { AIProviderType } from '../ai.types'
import { AnthropicRuntime } from './anthropic.runtime'
import type { IModelRuntime } from './model-runtime.interface'
import { OpenAICompatibleRuntime } from './openai-compatible.runtime'

export function createModelRuntime(
  config: AIProviderConfig,
  modelOverride?: string,
): IModelRuntime {
  const model = modelOverride || config.defaultModel

  const runtimeConfig = {
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    model,
    providerType: config.type,
    providerId: config.id,
  }

  switch (config.type) {
    case AIProviderType.Anthropic:
      return new AnthropicRuntime(runtimeConfig)

    case AIProviderType.OpenAI:
    case AIProviderType.OpenAICompatible:
    case AIProviderType.OpenRouter:
      return new OpenAICompatibleRuntime(runtimeConfig)

    default:
      throw new Error(`Unsupported provider type: ${config.type}`)
  }
}

export function createRuntimeForModelList(
  type: AIProviderType,
  apiKey: string,
  endpoint?: string,
): IModelRuntime {
  const config: AIProviderConfig = {
    id: 'temp',
    name: 'temp',
    type,
    apiKey,
    endpoint,
    defaultModel: 'temp',
    enabled: true,
  }

  return createModelRuntime(config)
}
