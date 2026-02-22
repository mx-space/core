import { jsonDiffStrategy, textDiffStrategy } from '~/modules/draft/diff'
import { describe, expect, it } from 'vitest'

describe('TextDiffStrategy', () => {
  it('should roundtrip create/apply patch', () => {
    const base = 'Hello world, this is a test document.'
    const current = 'Hello world, this is an updated document.'
    const patch = textDiffStrategy.createPatch(base, current)
    expect(patch).toBeTruthy()
    const restored = textDiffStrategy.applyPatch(base, patch)
    expect(restored).toBe(current)
  })

  it('should return empty patch for identical input', () => {
    const text = 'No changes here.'
    const patch = textDiffStrategy.createPatch(text, text)
    expect(patch).toBe('')
  })

  it('should detect oversized patch', () => {
    const patch = 'x'.repeat(800)
    const original = 'x'.repeat(1000)
    expect(textDiffStrategy.isOversized(patch, original, 0.7)).toBe(true)
    expect(textDiffStrategy.isOversized(patch, original, 0.9)).toBe(false)
  })

  it('should return base on corrupted patch', () => {
    const base = 'safe text'
    const result = textDiffStrategy.applyPatch(base, '%%%corrupted%%%')
    expect(result).toBe(base)
  })
})

describe('JsonDiffStrategy', () => {
  const lexicalBase = {
    root: {
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] },
      ],
    },
  }

  const lexicalUpdated = {
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Hello World' }],
        },
      ],
    },
  }

  it('should roundtrip create/apply patch for Lexical state', () => {
    const base = JSON.stringify(lexicalBase)
    const current = JSON.stringify(lexicalUpdated)
    const patch = jsonDiffStrategy.createPatch(base, current)
    expect(patch).toBeTruthy()
    const restored = jsonDiffStrategy.applyPatch(base, patch)
    expect(JSON.parse(restored)).toEqual(lexicalUpdated)
  })

  it('should return empty patch for identical JSON', () => {
    const json = JSON.stringify(lexicalBase)
    const patch = jsonDiffStrategy.createPatch(json, json)
    expect(patch).toBe('')
  })

  it('should detect oversized patch', () => {
    const patch = 'x'.repeat(800)
    const original = 'x'.repeat(1000)
    expect(jsonDiffStrategy.isOversized(patch, original, 0.7)).toBe(true)
  })

  it('should return base on corrupted patch', () => {
    const base = JSON.stringify(lexicalBase)
    const result = jsonDiffStrategy.applyPatch(base, '%%%corrupted%%%')
    expect(result).toBe(base)
  })

  it('should return empty patch on invalid JSON input', () => {
    const patch = jsonDiffStrategy.createPatch('not-json', 'also-not-json')
    expect(patch).toBe('')
  })

  it('should not mutate base when applying patch', () => {
    const base = JSON.stringify(lexicalBase)
    const current = JSON.stringify(lexicalUpdated)
    const patch = jsonDiffStrategy.createPatch(base, current)
    const baseBefore = JSON.parse(base)
    jsonDiffStrategy.applyPatch(base, patch)
    expect(JSON.parse(base)).toEqual(baseBefore)
  })
})
