import type { AIProviderConfig } from '../ai.types'
import { AIProviderType } from '../ai.types'
import type { IModelRuntime } from './model-runtime.interface'
import { PiRuntimeAdapter } from './pi-runtime.adapter'
import type { RuntimeConfig } from './types'

export function createModelRuntime(
  config: AIProviderConfig,
  modelOverride?: string,
): IModelRuntime {
  const model = modelOverride || config.defaultModel

  const runtimeConfig: RuntimeConfig = {
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    modelListUrl: config.modelListUrl,
    appendV1: config.appendV1,
    model,
    providerType: config.type,
    providerId: config.id,
  }

  switch (config.type) {
    case AIProviderType.Anthropic:
    case AIProviderType.OpenAICompatible:
    case AIProviderType.Generic: {
      return new PiRuntimeAdapter({
        ...runtimeConfig,
        contextWindow: config.contextWindow ?? undefined,
        maxTokens: config.maxTokens ?? undefined,
      })
    }

    default: {
      throw new Error(`Unsupported provider type: ${config.type as string}`)
    }
  }
}

export function createRuntimeForModelList(
  type: AIProviderType,
  apiKey: string,
  endpoint?: string,
  modelListUrl?: string,
): IModelRuntime {
  const config: AIProviderConfig = {
    id: 'temp',
    name: 'temp',
    type,
    apiKey,
    endpoint,
    modelListUrl,
    defaultModel: 'temp',
    enabled: true,
  }

  return createModelRuntime(config)
}
