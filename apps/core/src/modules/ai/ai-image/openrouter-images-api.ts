import type {
  AssistantImages,
  ImageContent,
  ImagesContext,
  ImagesFunction,
  ImagesModel,
  ImagesOptions,
  TextContent,
  Usage,
} from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'

import { getImageCatalogModel } from './image-catalog'
import type {
  OpenRouterImageRequestParams,
  SupportedImageParameters,
} from './image-param-mapping'
import {
  buildOpenRouterImageParams,
  supportsInputReferences,
} from './image-param-mapping'
import type { ImageGenerateOptions } from './image-runtime.interface'

const logger = new Logger('OpenRouterImagesApi')

export const OPENROUTER_IMAGES_API = 'openrouter-images-api' as const
export type OpenRouterImagesApi = typeof OPENROUTER_IMAGES_API

export interface OpenRouterImagesOptions extends ImagesOptions {
  aspectRatio?: ImageGenerateOptions['aspectRatio']
  quality?: ImageGenerateOptions['quality']
  outputFormat?: ImageGenerateOptions['format']
  providerParams?: Record<string, unknown>
  sessionId?: string
}

interface OpenRouterImageResponseItem {
  b64_json?: string
  media_type?: string
}

interface OpenRouterImagesResponse {
  created?: number
  data?: OpenRouterImageResponseItem[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    cost?: number
  }
}

const DEFAULT_IMAGE_MIME_TYPE = 'image/png'

export const generateOpenRouterImages: ImagesFunction<
  OpenRouterImagesApi,
  OpenRouterImagesOptions
> = async (
  model: ImagesModel<OpenRouterImagesApi>,
  context: ImagesContext,
  options?: OpenRouterImagesOptions,
): Promise<AssistantImages> => {
  const timestamp = Date.now()

  try {
    const apiKey = options?.apiKey
    if (!apiKey) {
      throw new Error(`No API key for provider: ${model.provider}`)
    }

    const supportedParameters = await resolveSupportedParameters(model, apiKey)
    const body = buildRequestBody(model, context, options, supportedParameters)

    const response = await fetch(`${model.baseUrl}/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(options?.sessionId
          ? { 'x-session-id': options.sessionId }
          : undefined),
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }

    const payload = (await response.json()) as OpenRouterImagesResponse
    const items = Array.isArray(payload.data) ? payload.data : []

    return {
      api: model.api,
      provider: model.provider,
      model: model.id,
      output: items
        .map((item) => parseImageItem(item))
        .filter((item): item is ImageContent => item !== null),
      usage: parseUsage(payload.usage),
      stopReason: 'stop',
      timestamp,
    }
  } catch (error) {
    return {
      api: model.api,
      provider: model.provider,
      model: model.id,
      output: [],
      stopReason: options?.signal?.aborted ? 'aborted' : 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp,
    }
  }
}

async function resolveSupportedParameters(
  model: ImagesModel<OpenRouterImagesApi>,
  apiKey: string,
): Promise<SupportedImageParameters> {
  try {
    const catalogModel = await getImageCatalogModel(
      { endpoint: model.baseUrl, apiKey },
      model.id,
    )
    if (!catalogModel) {
      logger.warn(
        `model ${model.id} is not in the OpenRouter images catalog; treating as unsupported (optional params will be dropped)`,
      )
    }
    return catalogModel?.supportedParameters ?? {}
  } catch (error) {
    // Fail closed rather than rethrow — the generation POST still proceeds.
    logger.warn(
      `image capability lookup failed for model ${model.id}: ${(error as Error).message}; treating as unsupported (optional params will be dropped)`,
    )
    return {}
  }
}

function buildRequestBody(
  model: ImagesModel<OpenRouterImagesApi>,
  context: ImagesContext,
  options: OpenRouterImagesOptions | undefined,
  supportedParameters: SupportedImageParameters,
): Record<string, unknown> {
  const textParts = context.input.filter(
    (item): item is TextContent => item.type === 'text',
  )
  const imageParts = context.input.filter(
    (item): item is ImageContent => item.type === 'image',
  )

  const params = buildOpenRouterImageParams(
    {
      aspectRatio: options?.aspectRatio,
      quality: options?.quality,
      format: options?.outputFormat,
    },
    supportedParameters,
  )
  const hasReferenceImages =
    imageParts.length > 0 && supportsInputReferences(supportedParameters)
  logDroppedParams(
    model,
    options,
    params,
    imageParts.length > 0,
    hasReferenceImages,
  )

  const body: Record<string, unknown> = {
    model: model.id,
    prompt: textParts.map((item) => item.text).join('\n'),
    ...params,
  }

  if (hasReferenceImages) {
    body.input_references = imageParts.map((item) => ({
      type: 'image_url',
      image_url: {
        url: `data:${item.mimeType};base64,${item.data}`,
      },
    }))
  }

  Object.assign(body, options?.providerParams)
  return body
}

function logDroppedParams(
  model: ImagesModel<OpenRouterImagesApi>,
  options: OpenRouterImagesOptions | undefined,
  params: OpenRouterImageRequestParams,
  requestedReferenceImages: boolean,
  hasReferenceImages: boolean,
): void {
  const dropped: string[] = []
  if (options?.aspectRatio && params.aspect_ratio === undefined) {
    dropped.push(`aspectRatio=${options.aspectRatio}`)
  }
  if (options?.quality && params.quality === undefined) {
    dropped.push(`quality=${options.quality}`)
  }
  if (options?.outputFormat && params.output_format === undefined) {
    dropped.push(`format=${options.outputFormat}`)
  }
  if (requestedReferenceImages && !hasReferenceImages) {
    dropped.push('referenceImages')
  }
  if (dropped.length > 0) {
    logger.warn(
      `model ${model.id} does not support [${dropped.join(', ')}] — dropped from the request`,
    )
  }
}

function parseImageItem(
  item: OpenRouterImageResponseItem,
): ImageContent | null {
  if (!item.b64_json) return null
  return {
    type: 'image',
    data: item.b64_json,
    mimeType:
      typeof item.media_type === 'string' && item.media_type.length > 0
        ? item.media_type
        : DEFAULT_IMAGE_MIME_TYPE,
  }
}

function parseUsage(raw: OpenRouterImagesResponse['usage']): Usage | undefined {
  if (!raw) return undefined
  const input = raw.prompt_tokens ?? 0
  const output = raw.completion_tokens ?? 0
  const totalTokens = raw.total_tokens ?? input + output
  const total = raw.cost ?? 0
  return {
    input,
    output,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total },
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown }
    }
    if (typeof payload.error?.message === 'string') {
      return payload.error.message
    }
  } catch {
    // Fall back to the HTTP status when the provider body is not valid JSON.
  }
  return `image generation request failed with status ${response.status}`
}
