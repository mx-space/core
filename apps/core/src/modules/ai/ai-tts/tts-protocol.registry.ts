import { AIProviderType } from '../ai.types'
import { ProtocolAdapterRegistry } from '../runtime/protocol-adapter.registry'
import { OpenAiCompatibleTtsProtocolAdapter } from './openai-compatible-tts-protocol.adapter'
import type {
  ITtsProtocolAdapter,
  TtsProtocolAdapterConfig,
} from './tts-protocol.types'
import { VertexTtsProtocolAdapter } from './vertex-tts-protocol.adapter'

export function createTtsProtocolAdapterRegistry(): ProtocolAdapterRegistry<
  TtsProtocolAdapterConfig,
  ITtsProtocolAdapter
> {
  return new ProtocolAdapterRegistry<
    TtsProtocolAdapterConfig,
    ITtsProtocolAdapter
  >()
    .register({
      id: 'vertex-gemini-tts',
      matches: (config) =>
        config.providerType === AIProviderType.GoogleVertex &&
        /(?:^|\/)gemini-.*tts(?:-|$)/.test(config.model.toLowerCase()),
      create: (config) => new VertexTtsProtocolAdapter(config),
    })
    .register({
      id: 'openai-compatible-speech',
      matches: (config) =>
        config.providerType === undefined ||
        config.providerType === AIProviderType.Generic ||
        config.providerType === AIProviderType.OpenAICompatible,
      create: (config) => new OpenAiCompatibleTtsProtocolAdapter(config),
    })
}

export const defaultTtsProtocolAdapterRegistry =
  createTtsProtocolAdapterRegistry()
