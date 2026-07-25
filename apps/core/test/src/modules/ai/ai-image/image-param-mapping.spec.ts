import { describe, expect, it } from 'vitest'

import type { SupportedImageParameters } from '~/modules/ai/ai-image/image-param-mapping'
import {
  buildOpenRouterImageParams,
  supportsInputReferences,
} from '~/modules/ai/ai-image/image-param-mapping'

const OPENAI_GPT_IMAGE_1: SupportedImageParameters = {
  quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high'] },
  background: { type: 'enum', values: ['auto', 'transparent', 'opaque'] },
  n: { type: 'range', min: 1, max: 10 },
  input_references: { type: 'range', min: 0, max: 16 },
  output_compression: { type: 'range', min: 0, max: 100 },
}

const GOOGLE_GEMINI_3_PRO_IMAGE: SupportedImageParameters = {
  resolution: { type: 'enum', values: ['1K', '2K', '4K'] },
  aspect_ratio: {
    type: 'enum',
    values: ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9'],
  },
  n: { type: 'range', min: 1, max: 1 },
  input_references: { type: 'range', min: 0, max: 14 },
}

describe('buildOpenRouterImageParams', () => {
  it('drops aspectRatio for a model whose supported_parameters omits aspect_ratio', () => {
    expect(
      buildOpenRouterImageParams({ aspectRatio: '16:9' }, OPENAI_GPT_IMAGE_1),
    ).toEqual({})
  })

  it('drops quality for a model whose supported_parameters omits quality', () => {
    expect(
      buildOpenRouterImageParams(
        { quality: 'high' },
        GOOGLE_GEMINI_3_PRO_IMAGE,
      ),
    ).toEqual({})
  })

  it('sends aspect_ratio verbatim for a model that supports it', () => {
    expect(
      buildOpenRouterImageParams(
        { aspectRatio: '16:9' },
        GOOGLE_GEMINI_3_PRO_IMAGE,
      ),
    ).toEqual({ aspect_ratio: '16:9' })
  })

  it.each([
    ['low', 'low'],
    ['standard', 'medium'],
    ['high', 'high'],
  ] as const)(
    'maps quality %s to wire value %s for a model that supports quality',
    (quality, wireValue) => {
      expect(
        buildOpenRouterImageParams({ quality }, OPENAI_GPT_IMAGE_1),
      ).toEqual({ quality: wireValue })
    },
  )

  it('drops format for a model whose supported_parameters omits output_format', () => {
    expect(
      buildOpenRouterImageParams({ format: 'png' }, OPENAI_GPT_IMAGE_1),
    ).toEqual({})
    expect(
      buildOpenRouterImageParams({ format: 'png' }, GOOGLE_GEMINI_3_PRO_IMAGE),
    ).toEqual({})
  })

  it('sends output_format verbatim for a model that supports it', () => {
    const supported: SupportedImageParameters = {
      output_format: { type: 'enum', values: ['png', 'jpeg'] },
    }
    expect(buildOpenRouterImageParams({ format: 'jpeg' }, supported)).toEqual({
      output_format: 'jpeg',
    })
  })

  it('only sends the subset of fields the model recognizes', () => {
    expect(
      buildOpenRouterImageParams(
        { aspectRatio: '16:9', quality: 'high', format: 'png' },
        OPENAI_GPT_IMAGE_1,
      ),
    ).toEqual({ quality: 'high' })

    expect(
      buildOpenRouterImageParams(
        { aspectRatio: '16:9', quality: 'high', format: 'png' },
        GOOGLE_GEMINI_3_PRO_IMAGE,
      ),
    ).toEqual({ aspect_ratio: '16:9' })
  })

  it('returns an empty payload when nothing is provided', () => {
    expect(buildOpenRouterImageParams({}, OPENAI_GPT_IMAGE_1)).toEqual({})
  })

  it('returns an empty payload when the model has no known supported_parameters', () => {
    expect(
      buildOpenRouterImageParams(
        { aspectRatio: '16:9', quality: 'high', format: 'png' },
        {},
      ),
    ).toEqual({})
  })

  it('drops aspectRatio when the key is supported but the specific value is not enumerated', () => {
    // gemini-3-pro-image's real aspect_ratio enum has no 21:9 — an admin
    // free-typing defaultAspectRatio must not leak an unsupported value.
    expect(
      buildOpenRouterImageParams(
        { aspectRatio: '21:9' as never },
        GOOGLE_GEMINI_3_PRO_IMAGE,
      ),
    ).toEqual({})
  })

  it('drops quality when the mapped wire value is not in the model-declared enum', () => {
    const supported: SupportedImageParameters = {
      quality: { type: 'enum', values: ['auto', 'low', 'high'] },
    }
    expect(
      buildOpenRouterImageParams({ quality: 'standard' }, supported),
    ).toEqual({})
  })

  it('drops format when the value is not in the model-declared output_format enum', () => {
    const supported: SupportedImageParameters = {
      output_format: { type: 'enum', values: ['png', 'jpeg'] },
    }
    expect(buildOpenRouterImageParams({ format: 'webp' }, supported)).toEqual(
      {},
    )
  })

  it('sends a range or boolean descriptor value without enumerated-value checking', () => {
    const supported: SupportedImageParameters = {
      aspect_ratio: { type: 'boolean' },
    }
    expect(
      buildOpenRouterImageParams({ aspectRatio: '16:9' }, supported),
    ).toEqual({ aspect_ratio: '16:9' })
  })
})

describe('supportsInputReferences', () => {
  it('is true when input_references is a range with max > 0', () => {
    expect(supportsInputReferences(OPENAI_GPT_IMAGE_1)).toBe(true)
    expect(supportsInputReferences(GOOGLE_GEMINI_3_PRO_IMAGE)).toBe(true)
  })

  it('is false when input_references is absent', () => {
    expect(supportsInputReferences({})).toBe(false)
  })

  it('is false when input_references is a range capped at 0', () => {
    expect(
      supportsInputReferences({
        input_references: { type: 'range', min: 0, max: 0 },
      }),
    ).toBe(false)
  })

  it('is true for a non-range (e.g. boolean) descriptor', () => {
    expect(
      supportsInputReferences({
        input_references: { type: 'boolean' },
      }),
    ).toBe(true)
  })
})
