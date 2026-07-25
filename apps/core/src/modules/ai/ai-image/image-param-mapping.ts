import type { ImageGenerateOptions } from './image-runtime.interface'

export type ImageParamMappingInput = Pick<
  ImageGenerateOptions,
  'aspectRatio' | 'quality' | 'format'
>

export type ImageParamMappingKind = 'openai' | 'gemini'

const OPENAI_ASPECT_RATIO_TO_SIZE: Record<
  NonNullable<ImageGenerateOptions['aspectRatio']>,
  string
> = {
  '1:1': '1024x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  '4:3': '1536x1024',
  '3:4': '1024x1536',
}

const OPENAI_QUALITY: Record<
  NonNullable<ImageGenerateOptions['quality']>,
  string
> = {
  low: 'low',
  standard: 'medium',
  high: 'high',
}

export function mapOpenAIImageParams(
  input: ImageParamMappingInput,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (input.aspectRatio) {
    payload.size = OPENAI_ASPECT_RATIO_TO_SIZE[input.aspectRatio]
  }
  if (input.quality) {
    payload.quality = OPENAI_QUALITY[input.quality]
  }
  if (input.format) {
    payload.output_format = input.format
  }
  return payload
}

const GEMINI_IMAGE_SIZE: Record<
  NonNullable<ImageGenerateOptions['quality']>,
  string
> = {
  low: '1K',
  standard: '1K',
  high: '2K',
}

const GEMINI_MIME_TYPE: Record<
  NonNullable<ImageGenerateOptions['format']>,
  string
> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/png',
}

export function mapGeminiImageParams(
  input: ImageParamMappingInput,
): Record<string, unknown> {
  const imageConfig: Record<string, unknown> = {}
  if (input.aspectRatio) {
    imageConfig.aspectRatio = input.aspectRatio
  }
  if (input.quality) {
    imageConfig.imageSize = GEMINI_IMAGE_SIZE[input.quality]
  }
  if (input.format) {
    imageConfig.mimeType = GEMINI_MIME_TYPE[input.format]
  }
  if (Object.keys(imageConfig).length === 0) {
    return {}
  }
  return { generationConfig: { imageConfig } }
}

export function mapImageParams(
  kind: ImageParamMappingKind,
  input: ImageParamMappingInput,
): Record<string, unknown> {
  return kind === 'gemini'
    ? mapGeminiImageParams(input)
    : mapOpenAIImageParams(input)
}

export function resolveImageParamMappingKind(
  providerId: string,
): ImageParamMappingKind {
  const normalized = providerId.toLowerCase()
  return normalized.includes('gemini') || normalized.includes('google')
    ? 'gemini'
    : 'openai'
}
