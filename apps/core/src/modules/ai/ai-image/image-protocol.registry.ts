import { AIProviderType } from '../ai.types'
import { ProtocolAdapterRegistry } from '../runtime/protocol-adapter.registry'
import type {
  IImageRuntime,
  ImageRuntimeAdapterConfig,
} from './image-runtime.interface'
import { OpenAiCompatibleImageProtocolAdapter } from './openai-compatible-image-protocol.adapter'
import {
  normalizeVertexModel,
  VertexGeminiImageProtocolAdapter,
  VertexImagenImageProtocolAdapter,
} from './vertex-image-protocol.adapter'

export function createImageProtocolAdapterRegistry(): ProtocolAdapterRegistry<
  ImageRuntimeAdapterConfig,
  IImageRuntime
> {
  return new ProtocolAdapterRegistry<ImageRuntimeAdapterConfig, IImageRuntime>()
    .register({
      id: 'vertex-gemini-generate-content',
      matches: (config) =>
        config.providerType === AIProviderType.GoogleVertex &&
        normalizeVertexModel(config.model).startsWith('gemini-'),
      create: (config) => new VertexGeminiImageProtocolAdapter(config),
    })
    .register({
      id: 'vertex-imagen-predict',
      matches: (config) =>
        config.providerType === AIProviderType.GoogleVertex &&
        normalizeVertexModel(config.model).startsWith('imagen-'),
      create: (config) => new VertexImagenImageProtocolAdapter(config),
    })
    .register({
      id: 'openai-compatible-images',
      matches: (config) =>
        config.providerType === undefined ||
        config.providerType === AIProviderType.Generic ||
        config.providerType === AIProviderType.OpenAICompatible,
      create: (config) => new OpenAiCompatibleImageProtocolAdapter(config),
    })
}

export const defaultImageProtocolAdapterRegistry =
  createImageProtocolAdapterRegistry()
