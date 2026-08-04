import { describe, expect, it } from 'vitest'

import { GenerateImageSchema } from '~/modules/ai/ai-image/ai-image.dto'

const base = { purpose: 'cover' as const, requestId: 'req-1' }

describe('GenerateImageSchema', () => {
  it('accepts manual mode: prompt without presetId/refId', () => {
    const result = GenerateImageSchema.safeParse({
      ...base,
      prompt: 'a cat wearing sunglasses',
    })
    expect(result.success).toBe(true)
  })

  it('accepts preset mode: presetId + refId without prompt', () => {
    const result = GenerateImageSchema.safeParse({
      ...base,
      presetId: 'signal-geometry',
      refId: 'article-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when neither prompt nor presetId+refId are given', () => {
    const result = GenerateImageSchema.safeParse({ ...base })
    expect(result.success).toBe(false)
  })

  it('accepts preset mode on an unsaved article: presetId + title + summary', () => {
    const result = GenerateImageSchema.safeParse({
      ...base,
      presetId: 'signal-geometry',
      title: 'an unsaved draft',
      summary: 'what it is about',
    })
    expect(result.success).toBe(true)
  })

  it('rejects preset mode missing refId, title and summary', () => {
    const result = GenerateImageSchema.safeParse({
      ...base,
      presetId: 'signal-geometry',
    })
    expect(result.success).toBe(false)
  })
})
