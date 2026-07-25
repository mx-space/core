import type {
  ImageContent,
  ImagesContext,
  ImagesModel,
  ImagesOptions,
  TextContent,
} from '@earendil-works/pi-ai'
import { builtinImagesModels } from '@earendil-works/pi-ai/providers/all'
import { generateImagesOpenRouter } from '@earendil-works/pi-ai/providers/images/register-builtins'

import { AppErrorCode, createAppException } from '~/common/errors'

import type { ImageParamMappingKind } from './image-param-mapping'
import {
  mapImageParams,
  resolveImageParamMappingKind,
} from './image-param-mapping'
import type {
  GeneratedImage,
  IImageRuntime,
  ImageGenerateOptions,
} from './image-runtime.interface'

export interface ImageRuntimeAdapterConfig {
  provider: string
  apiKey: string
  endpoint?: string
  model: string
}

export class ImageRuntimeAdapter implements IImageRuntime {
  private readonly model: ImagesModel<'openrouter-images'>
  private readonly apiKey: string
  private readonly mappingKind: ImageParamMappingKind

  constructor(config: ImageRuntimeAdapterConfig) {
    this.apiKey = config.apiKey
    this.mappingKind = resolveImageParamMappingKind(config.provider)
    this.model = {
      id: config.model,
      name: config.model,
      api: 'openrouter-images',
      provider: config.provider,
      baseUrl: this.resolveBaseUrl(config),
      input: ['text', 'image'],
      output: ['image'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }
  }

  async generateImage(
    opts: ImageGenerateOptions,
  ): Promise<{ images: GeneratedImage[] }> {
    const context: ImagesContext = { input: this.buildInput(opts) }
    const options: ImagesOptions = {
      apiKey: this.apiKey,
      signal: opts.signal,
      onPayload: (payload) => ({
        ...(payload as Record<string, unknown>),
        ...mapImageParams(this.mappingKind, opts),
        ...opts.providerParams,
      }),
    }

    const result = await generateImagesOpenRouter(this.model, context, options)

    if (result.stopReason !== 'stop') {
      throw createAppException(AppErrorCode.IMAGE_GENERATION_FAILED, {
        message:
          result.errorMessage ??
          `image generation ended with stopReason "${result.stopReason}"`,
      })
    }

    const images = result.output
      .filter((content): content is ImageContent => content.type === 'image')
      .map((content) => ({
        buffer: Buffer.from(content.data, 'base64'),
        mimeType: content.mimeType,
      }))

    return { images }
  }

  async listModels(): Promise<{ id: string; provider: string }[]> {
    return [{ id: this.model.id, provider: this.model.provider }]
  }

  private resolveBaseUrl(config: ImageRuntimeAdapterConfig): string {
    const trimmed = config.endpoint?.trim()
    if (trimmed) return trimmed
    return (
      builtinImagesModels().getModel(config.provider, config.model)?.baseUrl ??
      ''
    )
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
