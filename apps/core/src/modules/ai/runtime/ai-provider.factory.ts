import type {
  AIProviderConfig,
  AIProviderType,
  AIReasoningEffort,
} from '../ai.types'
import type { IModelRuntime } from './model-runtime.interface'
import type { TextProtocolAdapterConfig } from './text-protocol.registry'
import { defaultTextProtocolAdapterRegistry } from './text-protocol.registry'

export function createModelRuntime(
  config: AIProviderConfig,
  modelOverride?: string,
  options?: { reasoningEffort?: AIReasoningEffort; sessionId?: string },
): IModelRuntime {
  const model = modelOverride || config.defaultModel

  const runtimeConfig: TextProtocolAdapterConfig = {
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    projectId: config.projectId,
    modelListUrl: config.modelListUrl,
    appendV1: config.appendV1,
    model,
    providerType: config.type,
    providerId: config.id,
    contextWindow: config.contextWindow ?? undefined,
    maxTokens: config.maxTokens ?? undefined,
    reasoningEffort: options?.reasoningEffort,
    sessionId: options?.sessionId,
  }

  return defaultTextProtocolAdapterRegistry.resolve(runtimeConfig)
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
