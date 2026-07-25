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
  if (
    input.aspectRatio &&
    isValueSupported(supportedParameters.aspect_ratio, input.aspectRatio)
  ) {
    params.aspect_ratio = input.aspectRatio
  }
  if (input.quality) {
    const wireQuality = QUALITY_TO_WIRE[input.quality]
    if (isValueSupported(supportedParameters.quality, wireQuality)) {
      params.quality = wireQuality
    }
  }
  if (
    input.format &&
    isValueSupported(supportedParameters.output_format, input.format)
  ) {
    params.output_format = input.format
  }
  return params
}

function isValueSupported(
  descriptor: ImageParameterDescriptor | undefined,
  value: string,
): boolean {
  if (!descriptor) return false
  return descriptor.type !== 'enum' || descriptor.values.includes(value)
}

export function supportsInputReferences(
  supportedParameters: SupportedImageParameters,
): boolean {
  const descriptor = supportedParameters.input_references
  if (!descriptor) return false
  return descriptor.type !== 'range' || descriptor.max > 0
}
