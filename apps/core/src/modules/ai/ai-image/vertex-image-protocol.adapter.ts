import { getVertexMediaModels } from '../vertex/vertex-model-catalog'
import type {
  GeneratedImage,
  IImageRuntime,
  ImageGenerateOptions,
  ImageRuntimeAdapterConfig,
} from './image-runtime.interface'
import {
  generateVertexGeminiImage,
  generateVertexImagenImage,
} from './vertex-image-api'

abstract class VertexImageProtocolAdapter implements IImageRuntime {
  constructor(protected readonly config: ImageRuntimeAdapterConfig) {}

  abstract generateImage(
    opts: ImageGenerateOptions,
  ): Promise<{ images: GeneratedImage[] }>

  async listModels(): Promise<{ id: string; provider: string }[]> {
    return getVertexMediaModels('image').map((model) => ({
      id: model.id,
      provider: this.config.provider,
    }))
  }
}

export class VertexGeminiImageProtocolAdapter extends VertexImageProtocolAdapter {
  async generateImage(
    options: ImageGenerateOptions,
  ): Promise<{ images: GeneratedImage[] }> {
    return {
      images: await generateVertexGeminiImage({
        apiKey: this.config.apiKey,
        connection: this.config,
        model: normalizeVertexModel(this.config.model),
        options,
      }),
    }
  }
}

export class VertexImagenImageProtocolAdapter extends VertexImageProtocolAdapter {
  async generateImage(
    options: ImageGenerateOptions,
  ): Promise<{ images: GeneratedImage[] }> {
    return {
      images: await generateVertexImagenImage({
        apiKey: this.config.apiKey,
        connection: this.config,
        model: normalizeVertexModel(this.config.model),
        options,
      }),
    }
  }
}

export function normalizeVertexModel(model: string): string {
  return model.replace(/^google\//, '').trim()
}
