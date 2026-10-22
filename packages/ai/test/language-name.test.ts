import { describe, expect, it } from 'vitest'

import {
  AI_PROMPTS,
  LANGUAGE_CODE_TO_NAME,
  resolveBaseLanguageCode,
  resolveLanguageName,
} from '../src/prompts'

describe('resolveLanguageName', () => {
  it('keeps the name of every folded base code', () => {
    for (const [code, name] of Object.entries(LANGUAGE_CODE_TO_NAME)) {
      expect(resolveLanguageName(code)).toBe(name)
    }
    expect(resolveLanguageName('zh')).toBe('Simplified Chinese')
    expect(resolveLanguageName('pt')).toBe('Portuguese')
    expect(resolveLanguageName('en')).toBe('English')
  })

  it('distinguishes Chinese scripts and regions', () => {
    expect(resolveLanguageName('zh-TW')).toBe('Traditional Chinese')
    expect(resolveLanguageName('zh_tw')).toBe('Traditional Chinese')
    expect(resolveLanguageName('tw')).toBe('Traditional Chinese')
    expect(resolveLanguageName('zh-HK')).toBe('Traditional Chinese')
    expect(resolveLanguageName('zh-Hant')).toBe('Traditional Chinese')
    expect(resolveLanguageName('zh-Hant-HK')).toBe('Traditional Chinese')
    expect(resolveLanguageName('zh-CN')).toBe('Simplified Chinese')
    expect(resolveLanguageName('cn')).toBe('Simplified Chinese')
    expect(resolveLanguageName('zh-Hans')).toBe('Simplified Chinese')
    expect(resolveLanguageName('zh-Hans-TW')).toBe('Simplified Chinese')
  })

  it('names other regional variants', () => {
    expect(resolveLanguageName('pt-BR')).toBe('Brazilian Portuguese')
    expect(resolveLanguageName('pt-PT')).toBe('European Portuguese')
    expect(resolveLanguageName('es-419')).toBe('Latin American Spanish')
    expect(resolveLanguageName('en-GB')).toBe('British English')
    expect(resolveLanguageName('fr-CA')).toBe('Canadian French')
  })

  it('falls back to the base code for unlisted regions', () => {
    expect(resolveLanguageName('fr-BE')).toBe('French')
    expect(resolveLanguageName('ja-JP')).toBe('Japanese')
    expect(resolveLanguageName('de-AT')).toBe('German')
    expect(resolveLanguageName('jp')).toBe('Japanese')
    expect(resolveLanguageName('jpn')).toBe('Japanese')
  })

  it('returns undefined for unknown codes', () => {
    expect(resolveLanguageName('yo')).toBeUndefined()
    expect(resolveLanguageName('fil-ph')).toBeUndefined()
    expect(resolveLanguageName('english')).toBeUndefined()
    expect(resolveLanguageName('')).toBeUndefined()
    expect(resolveLanguageName(undefined)).toBeUndefined()
  })
})

describe('resolveBaseLanguageCode', () => {
  it('folds regional tags and passes unknown tokens through', () => {
    expect(resolveBaseLanguageCode('ja-JP')).toBe('ja')
    expect(resolveBaseLanguageCode('zh-TW')).toBe('zh')
    expect(resolveBaseLanguageCode('zh')).toBe('zh')
    expect(resolveBaseLanguageCode('fil-ph')).toBe('fil-ph')
  })
})

describe('AI_PROMPTS target language', () => {
  it('renders regional names into prompts', () => {
    expect(AI_PROMPTS.summaryTranslation('zh-TW', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Traditional Chinese',
    )
    expect(AI_PROMPTS.fieldTranslation('pt-BR', { a: 'b' }).prompt).toContain(
      'TARGET_LANGUAGE: Brazilian Portuguese',
    )
    expect(AI_PROMPTS.summary('zh-Hant', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Traditional Chinese',
    )
  })

  it('keeps folded-code prompts unchanged', () => {
    expect(AI_PROMPTS.summaryTranslation('zh', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Simplified Chinese',
    )
    expect(AI_PROMPTS.summaryTranslation('fil', 'x').prompt).toContain(
      'TARGET_LANGUAGE: fil',
    )
    expect(AI_PROMPTS.summary('fil', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Simplified Chinese',
    )
  })

  it('applies base-language partials to regional targets', () => {
    const chunk = (lang: string) =>
      AI_PROMPTS.translationChunk(lang, {
        documentContext: '',
        textEntries: { a: 'b' },
      }).systemPrompt
    expect(chunk('ja-JP')).toBe(chunk('ja'))
    expect(chunk('zh-TW')).toBe(chunk('zh'))
    expect(chunk('en-GB')).toBe(chunk('en'))
    expect(chunk('fr')).not.toBe(chunk('ja'))
  })
})
