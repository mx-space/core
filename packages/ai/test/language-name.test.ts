import { describe, expect, it } from 'vitest'

import {
  AI_PROMPTS,
  DEFAULT_SUMMARY_LANG,
  resolveBaseLanguageCode,
  resolveLanguageName,
} from '../src/prompts'

describe('DEFAULT_SUMMARY_LANG', () => {
  it('is a canonical language-region tag', () => {
    expect(DEFAULT_SUMMARY_LANG).toBe('zh-CN')
  })
})

describe('resolveLanguageName', () => {
  it('names the script so Chinese variants are unambiguous', () => {
    expect(resolveLanguageName('zh-CN')).toBe(
      'Chinese (China), Simplified script',
    )
    expect(resolveLanguageName('zh-TW')).toBe(
      'Chinese (Taiwan), Traditional script',
    )
    expect(resolveLanguageName('zh-Hant')).toBe(
      'Chinese (Taiwan), Traditional script',
    )
    expect(resolveLanguageName('zh-HK')).toContain('Traditional script')
  })

  it('names regional variants', () => {
    expect(resolveLanguageName('en-US')).toBe('American English, Latin script')
    expect(resolveLanguageName('pt-BR')).toBe(
      'Brazilian Portuguese, Latin script',
    )
    expect(resolveLanguageName('es-419')).toBe(
      'Latin American Spanish, Latin script',
    )
  })

  it('canonicalizes bare language codes first', () => {
    expect(resolveLanguageName('ja')).toBe(resolveLanguageName('ja-JP'))
    expect(resolveLanguageName('zh')).toBe(resolveLanguageName('zh-CN'))
  })

  it('returns undefined for invalid tags', () => {
    expect(resolveLanguageName('jp')).toBeUndefined()
    expect(resolveLanguageName('english')).toBeUndefined()
    expect(resolveLanguageName('')).toBeUndefined()
    expect(resolveLanguageName(undefined)).toBeUndefined()
  })
})

describe('resolveBaseLanguageCode', () => {
  it('returns the language subtag', () => {
    expect(resolveBaseLanguageCode('ja-JP')).toBe('ja')
    expect(resolveBaseLanguageCode('zh-TW')).toBe('zh')
    expect(resolveBaseLanguageCode('fil-PH')).toBe('fil')
  })

  it('passes invalid tokens through', () => {
    expect(resolveBaseLanguageCode('english')).toBe('english')
  })
})

describe('AI_PROMPTS target language', () => {
  it('renders script-qualified names into prompts', () => {
    expect(AI_PROMPTS.summaryTranslation('zh-TW', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Chinese (Taiwan), Traditional script',
    )
    expect(AI_PROMPTS.summary('zh-CN', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Chinese (China), Simplified script',
    )
  })

  it('falls back to the default language name for invalid summary targets', () => {
    expect(AI_PROMPTS.summary('english', 'x').prompt).toContain(
      'TARGET_LANGUAGE: Chinese (China), Simplified script',
    )
  })

  it('applies base-language partials to every region', () => {
    const chunk = (lang: string) =>
      AI_PROMPTS.translationChunk(lang, {
        documentContext: '',
        textEntries: { a: 'b' },
      }).systemPrompt
    expect(chunk('zh-TW')).toBe(chunk('zh-CN'))
    expect(chunk('en-GB')).toBe(chunk('en-US'))
    expect(chunk('fr-FR')).not.toBe(chunk('ja-JP'))
  })

  it('asks the title model for a language-region tag', () => {
    const { schema } = AI_PROMPTS.writer.titleAndSlug('x')
    expect(JSON.stringify(schema)).toContain('zh-TW')
  })
})
