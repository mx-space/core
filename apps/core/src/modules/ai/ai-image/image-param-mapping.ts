import type { ImageParameterDescriptor } from './image-catalog'
import type { ImageGenerateOptions } from './image-runtime.interface'

export type SupportedImageParameters = Record<string, ImageParameterDescriptor>

export type ImageParamMappingInput = Pick<
  ImageGenerateOptions,
  'aspectRatio' | 'quality' | 'format'
>

export interface OpenRouterImageRequestParams {
  aspect_ratio?: string
  quality?: string
  output_format?: string
}

const QUALITY_TO_WIRE: Record<
  NonNullable<ImageGenerateOptions['quality']>,
  string
> = {
  low: 'low',
  standard: 'medium',
  high: 'high',
}

export function buildOpenRouterImageParams(
  input: ImageParamMappingInput,
  supportedParameters: SupportedImageParameters,
): OpenRouterImageRequestParams {
  const params: OpenRouterImageRequestParams = {}
  if (input.aspectRatio && 'aspect_ratio' in supportedParameters) {
    params.aspect_ratio = input.aspectRatio
  }
  if (input.quality && 'quality' in supportedParameters) {
    params.quality = QUALITY_TO_WIRE[input.quality]
  }
  if (input.format && 'output_format' in supportedParameters) {
    params.output_format = input.format
  }
  return params
}

export function supportsInputReferences(
  supportedParameters: SupportedImageParameters,
): boolean {
  const descriptor = supportedParameters.input_references
  if (!descriptor) return false
  return descriptor.type !== 'range' || descriptor.max > 0
}
