import { describe, expect, it } from 'vitest'

import { CreateMemorySchema } from '~/modules/ai/ai-memory/ai-memory.schema'

describe('CreateMemorySchema scope regex', () => {
  it.each([
    'global',
    'persona:inner-self',
    'persona:passerby',
    'scenario:recently',
    'scenario:comment-reply',
  ])('accepts %s', (scope) => {
    const result = CreateMemorySchema.safeParse({
      scope,
      type: 'fact',
      content: 'hello',
    })
    expect(result.success).toBe(true)
  })

  it.each([
    'Global',
    'persona:',
    'persona:Inner-Self',
    'persona:inner_self',
    'scenario:Recently',
    'random',
    'global:extra',
    'persona',
    'scenario:',
  ])('rejects %s', (scope) => {
    const result = CreateMemorySchema.safeParse({
      scope,
      type: 'fact',
      content: 'hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown memory type', () => {
    const result = CreateMemorySchema.safeParse({
      scope: 'global',
      type: 'unknown',
      content: 'x',
    })
    expect(result.success).toBe(false)
  })

  it('enforces content length 1..2000', () => {
    expect(
      CreateMemorySchema.safeParse({
        scope: 'global',
        type: 'fact',
        content: '',
      }).success,
    ).toBe(false)
    expect(
      CreateMemorySchema.safeParse({
        scope: 'global',
        type: 'fact',
        content: 'a'.repeat(2001),
      }).success,
    ).toBe(false)
    expect(
      CreateMemorySchema.safeParse({
        scope: 'global',
        type: 'fact',
        content: 'a'.repeat(2000),
      }).success,
    ).toBe(true)
  })

  it('applies default confidence / salience', () => {
    const parsed = CreateMemorySchema.parse({
      scope: 'global',
      type: 'fact',
      content: 'x',
    })
    expect(parsed.confidence).toBe(1)
    expect(parsed.salience).toBe(1)
  })
})
