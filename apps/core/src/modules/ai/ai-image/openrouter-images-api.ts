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

import { fetchImageCatalogModel } from './image-catalog'
import type { SupportedImageParameters } from './image-param-mapping'
import {
  buildOpenRouterImageParams,
  supportsInputReferences,
} from './image-param-mapping'
import type { ImageGenerateOptions } from './image-runtime.interface'

export const OPENROUTER_IMAGES_API = 'openrouter-images-api' as const
export type OpenRouterImagesApi = typeof OPENROUTER_IMAGES_API

export interface OpenRouterImagesOptions extends ImagesOptions {
  aspectRatio?: ImageGenerateOptions['aspectRatio']
  quality?: ImageGenerateOptions['quality']
  outputFormat?: ImageGenerateOptions['format']
  providerParams?: Record<string, unknown>
}

interface OpenRouterImageResponseItem {
  b64_json?: unknown
  media_type?: unknown
}

interface OpenRouterImagesResponse {
  data?: OpenRouterImageResponseItem[]
  usage?: {
    prompt_tokens?: unknown
    completion_tokens?: unknown
    total_tokens?: unknown
    cost?: unknown
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
    const catalogModel = await fetchImageCatalogModel(
      { endpoint: model.baseUrl, apiKey },
      model.id,
    )
    return catalogModel?.supportedParameters ?? {}
  } catch {
    // Catalog lookup failing (or the model being unlisted) means "unknown
    // support" — fail closed to an empty map so optional params get dropped
    // rather than sent on a guess. The generation POST below still proceeds.
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

  const body: Record<string, unknown> = {
    model: model.id,
    prompt: textParts.map((item) => item.text).join('\n'),
    ...buildOpenRouterImageParams(
      {
        aspectRatio: options?.aspectRatio,
        quality: options?.quality,
        format: options?.outputFormat,
      },
      supportedParameters,
    ),
  }

  if (imageParts.length > 0 && supportsInputReferences(supportedParameters)) {
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

function parseImageItem(
  item: OpenRouterImageResponseItem,
): ImageContent | null {
  if (typeof item.b64_json !== 'string' || item.b64_json.length === 0) {
    return null
  }
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
  const input = typeof raw.prompt_tokens === 'number' ? raw.prompt_tokens : 0
  const output =
    typeof raw.completion_tokens === 'number' ? raw.completion_tokens : 0
  const totalTokens =
    typeof raw.total_tokens === 'number' ? raw.total_tokens : input + output
  const total = typeof raw.cost === 'number' ? raw.cost : 0
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
    // response body wasn't JSON; fall through to the status-based message
  }
  return `image generation request failed with status ${response.status}`
}
