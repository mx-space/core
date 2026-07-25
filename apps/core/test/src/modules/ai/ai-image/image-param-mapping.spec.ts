import { describe, expect, it } from 'vitest'

import {
  mapGeminiImageParams,
  mapOpenAIImageParams,
  resolveImageParamMappingKind,
} from '~/modules/ai/ai-image/image-param-mapping'

describe('mapOpenAIImageParams', () => {
  it.each([
    ['16:9', '1536x1024'],
    ['1:1', '1024x1024'],
    ['9:16', '1024x1536'],
    ['3:2', '1536x1024'],
    ['2:3', '1024x1536'],
    ['4:3', '1536x1024'],
    ['3:4', '1024x1536'],
  ] as const)('maps aspectRatio %s to size %s', (aspectRatio, size) => {
    expect(mapOpenAIImageParams({ aspectRatio })).toEqual({ size })
  })

  it.each([
    ['low', 'low'],
    ['standard', 'medium'],
    ['high', 'high'],
  ] as const)('maps quality %s to %s', (quality, mapped) => {
    expect(mapOpenAIImageParams({ quality })).toEqual({ quality: mapped })
  })

  it.each(['png', 'jpeg', 'webp'] as const)(
    'maps format %s to output_format',
    (format) => {
      expect(mapOpenAIImageParams({ format })).toEqual({
        output_format: format,
      })
    },
  )

  it('merges all provided fields', () => {
    expect(
      mapOpenAIImageParams({
        aspectRatio: '1:1',
        quality: 'high',
        format: 'png',
      }),
    ).toEqual({ size: '1024x1024', quality: 'high', output_format: 'png' })
  })

  it('returns an empty payload when nothing is provided', () => {
    expect(mapOpenAIImageParams({})).toEqual({})
  })
})

describe('mapGeminiImageParams', () => {
  it.each(['16:9', '1:1', '9:16', '3:2', '2:3', '4:3', '3:4'] as const)(
    'passes aspectRatio %s through as-is',
    (aspectRatio) => {
      expect(mapGeminiImageParams({ aspectRatio })).toEqual({
        generationConfig: { imageConfig: { aspectRatio } },
      })
    },
  )

  it.each([
    ['low', '1K'],
    ['standard', '1K'],
    ['high', '2K'],
  ] as const)('maps quality %s to imageSize %s', (quality, imageSize) => {
    expect(mapGeminiImageParams({ quality })).toEqual({
      generationConfig: { imageConfig: { imageSize } },
    })
  })

  it.each([
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
  ] as const)('maps format %s to mimeType %s', (format, mimeType) => {
    expect(mapGeminiImageParams({ format })).toEqual({
      generationConfig: { imageConfig: { mimeType } },
    })
  })

  it('falls back to image/png for unsupported webp format', () => {
    expect(mapGeminiImageParams({ format: 'webp' })).toEqual({
      generationConfig: { imageConfig: { mimeType: 'image/png' } },
    })
  })

  it('merges all provided fields under generationConfig.imageConfig', () => {
    expect(
      mapGeminiImageParams({
        aspectRatio: '16:9',
        quality: 'high',
        format: 'jpeg',
      }),
    ).toEqual({
      generationConfig: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '2K',
          mimeType: 'image/jpeg',
        },
      },
    })
  })

  it('returns an empty payload when nothing is provided', () => {
    expect(mapGeminiImageParams({})).toEqual({})
  })
})

describe('resolveImageParamMappingKind', () => {
  it('resolves openai for the default openrouter provider', () => {
    expect(resolveImageParamMappingKind('openrouter')).toBe('openai')
  })

  it('resolves gemini for provider ids mentioning gemini or google', () => {
    expect(resolveImageParamMappingKind('gemini')).toBe('gemini')
    expect(resolveImageParamMappingKind('google-vertex')).toBe('gemini')
  })
})
