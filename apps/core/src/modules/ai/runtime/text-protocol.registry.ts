import { AIProviderType } from '../ai.types'
import type { IModelRuntime } from './model-runtime.interface'
import { PiRuntimeAdapter } from './pi-runtime.adapter'
import { ProtocolAdapterRegistry } from './protocol-adapter.registry'
import type { ReasoningEffort, RuntimeConfig } from './types'

export interface TextProtocolAdapterConfig extends RuntimeConfig {
  contextWindow?: number | null
  maxTokens?: number | null
  reasoningEffort?: ReasoningEffort
}

export function createTextProtocolAdapterRegistry(): ProtocolAdapterRegistry<
  TextProtocolAdapterConfig,
  IModelRuntime
> {
  return new ProtocolAdapterRegistry<TextProtocolAdapterConfig, IModelRuntime>()
    .register({
      id: 'anthropic-messages',
      matches: (config) => config.providerType === AIProviderType.Anthropic,
      create: (config) =>
        new PiRuntimeAdapter(config, { api: 'anthropic-messages' }),
    })
    .register({
      id: 'google-vertex-openai-compatible',
      matches: (config) => config.providerType === AIProviderType.GoogleVertex,
      create: (config) =>
        new PiRuntimeAdapter(config, { api: 'openai-completions' }),
    })
    .register({
      id: 'openai-compatible-completions',
      matches: (config) =>
        config.providerType === AIProviderType.Generic ||
        config.providerType === AIProviderType.OpenAICompatible,
      create: (config) =>
        new PiRuntimeAdapter(config, { api: 'openai-completions' }),
    })
}

export const defaultTextProtocolAdapterRegistry =
  createTextProtocolAdapterRegistry()
