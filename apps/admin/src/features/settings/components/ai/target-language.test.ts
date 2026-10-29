import { describe, expect, it } from 'vitest'

import { parseTargetLanguageDraft } from './target-language'

describe('parseTargetLanguageDraft', () => {
  it('canonicalizes a typed tag to language-REGION', () => {
    expect(parseTargetLanguageDraft(' zh-tw ', [])).toEqual({ lang: 'zh-TW' })
    expect(parseTargetLanguageDraft('zh-Hant', [])).toEqual({ lang: 'zh-TW' })
    expect(parseTargetLanguageDraft('en', [])).toEqual({ lang: 'en-US' })
  })

  it('rejects unknown tags', () => {
    expect(parseTargetLanguageDraft('english', [])).toEqual({
      error: 'invalid',
    })
    expect(parseTargetLanguageDraft('jp', [])).toEqual({ error: 'invalid' })
  })

  it('reports a language that is already configured', () => {
    expect(parseTargetLanguageDraft('en', ['en-US'])).toEqual({
      error: 'exists',
      lang: 'en-US',
    })
  })
})
