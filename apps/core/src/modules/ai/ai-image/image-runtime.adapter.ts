import type {
  ImageContent,
  ImagesContext,
  ImagesModel,
  TextContent,
} from '@earendil-works/pi-ai'

import { AppErrorCode, createAppException } from '~/common/errors'

import { resolveOpenRouterImagesBaseUrl } from './image-catalog'
import type {
  GeneratedImage,
  IImageRuntime,
  ImageGenerateOptions,
} from './image-runtime.interface'
import {
  generateOpenRouterImages,
  OPENROUTER_IMAGES_API,
  type OpenRouterImagesApi,
  type OpenRouterImagesOptions,
} from './openrouter-images-api'

export interface ImageRuntimeAdapterConfig {
  provider: string
  apiKey: string
  endpoint?: string
  model: string
}

export class ImageRuntimeAdapter implements IImageRuntime {
  private readonly model: ImagesModel<OpenRouterImagesApi>
  private readonly apiKey: string

  constructor(config: ImageRuntimeAdapterConfig) {
    this.apiKey = config.apiKey
    this.model = {
      id: config.model,
      name: config.model,
      api: OPENROUTER_IMAGES_API,
      provider: config.provider,
      baseUrl: resolveOpenRouterImagesBaseUrl(config.endpoint),
      input: ['text', 'image'],
      output: ['image'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }
  }

  async generateImage(
    opts: ImageGenerateOptions,
  ): Promise<{ images: GeneratedImage[] }> {
    const context: ImagesContext = { input: this.buildInput(opts) }
    const options: OpenRouterImagesOptions = {
      apiKey: this.apiKey,
      signal: opts.signal,
      aspectRatio: opts.aspectRatio,
      quality: opts.quality,
      outputFormat: opts.format,
      providerParams: opts.providerParams,
    }

    const result = await generateOpenRouterImages(this.model, context, options)

    if (result.stopReason !== 'stop') {
      throw createAppException(AppErrorCode.IMAGE_GENERATION_FAILED, {
        message:
          result.errorMessage ??
          `image generation ended with stopReason "${result.stopReason}"`,
      })
    }

    const images = result.output
      .filter((content): content is ImageContent => content.type === 'image')
      .map((content): GeneratedImage | null => {
        // content.data is typed string but reaches here from an unvalidated cast
        // of upstream JSON — this runtime check is not redundant with the type.
        if (typeof content.data !== 'string') return null
        const buffer = Buffer.from(content.data, 'base64')
        if (buffer.length === 0) return null
        return { buffer, mimeType: content.mimeType }
      })
      .filter((image): image is GeneratedImage => image !== null)

    return { images }
  }

  async listModels(): Promise<{ id: string; provider: string }[]> {
    return [{ id: this.model.id, provider: this.model.provider }]
  }

  private buildInput(
    opts: ImageGenerateOptions,
  ): (TextContent | ImageContent)[] {
    const input: (TextContent | ImageContent)[] = [
      { type: 'text', text: opts.prompt },
    ]
    for (const ref of opts.referenceImages ?? []) {
      input.push({
        type: 'image',
        data: ref.data.toString('base64'),
        mimeType: ref.mimeType,
      })
    }
    return input
  }
}
