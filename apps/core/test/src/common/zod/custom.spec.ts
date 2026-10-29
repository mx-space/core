import { describe, expect, it } from 'vitest'

import { zLang, zLanguageTag } from '~/common/zod/custom'

describe('zLang', () => {
  it('canonicalizes region-qualified tags', () => {
    expect(zLang.parse('zh-TW')).toBe('zh-TW')
    expect(zLang.parse('zh_tw')).toBe('zh-TW')
    expect(zLang.parse('en')).toBe('en-US')
  })

  it('treats original and invalid tags as no language', () => {
    expect(zLang.parse('original')).toBeUndefined()
    expect(zLang.parse('jp')).toBeUndefined()
    expect(zLang.parse(undefined)).toBeUndefined()
  })
})

describe('zLanguageTag', () => {
  it('canonicalizes a known tag', () => {
    expect(zLanguageTag.parse(' zh_tw ')).toBe('zh-TW')
    expect(zLanguageTag.parse('ja')).toBe('ja-JP')
  })

  it('rejects unknown tags', () => {
    expect(() => zLanguageTag.parse('jp')).toThrow()
    expect(() => zLanguageTag.parse('english')).toThrow()
    expect(() => zLanguageTag.parse('')).toThrow()
  })
})
