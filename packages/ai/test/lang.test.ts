import { describe, expect, it } from 'vitest'

import { normalizeLanguageCode, normalizeTargetLang } from '../src'

describe('normalizeLanguageCode', () => {
  it('folds regional variants by default', () => {
    expect(normalizeLanguageCode('zh-CN')).toBe('zh')
    expect(normalizeLanguageCode('zh_TW')).toBe('zh')
    expect(normalizeLanguageCode('pt-BR')).toBe('pt')
    expect(normalizeLanguageCode('en-US')).toBe('en')
    expect(normalizeLanguageCode('tw')).toBe('zh')
    expect(normalizeLanguageCode('jp')).toBe('ja')
    expect(normalizeLanguageCode('jpn')).toBe('ja')
    expect(normalizeLanguageCode('fr-CA')).toBe('fr')
  })

  it('keeps regional variants distinct when folding is off', () => {
    const options = { foldRegion: false }
    expect(normalizeLanguageCode('zh-cn', options)).toBe('zh-CN')
    expect(normalizeLanguageCode('zh_TW', options)).toBe('zh-TW')
    expect(normalizeLanguageCode('pt-br', options)).toBe('pt-BR')
    expect(normalizeLanguageCode('zh-hant', options)).toBe('zh-Hant')
    expect(normalizeLanguageCode('es-419', options)).toBe('es-419')
    expect(normalizeLanguageCode('tw', options)).toBe('zh-TW')
    expect(normalizeLanguageCode('jp', options)).toBe('ja')
    expect(normalizeLanguageCode('zho', options)).toBe('zh')
    expect(normalizeLanguageCode('en', options)).toBe('en')
    expect(normalizeLanguageCode('english', options)).toBeUndefined()
    expect(normalizeLanguageCode('', options)).toBeUndefined()
  })
})

describe('normalizeTargetLang', () => {
  it('folds by default and passes unknown tokens through', () => {
    expect(normalizeTargetLang('zh-CN')).toBe('zh')
    expect(normalizeTargetLang(' Spanish ')).toBe('spanish')
    expect(normalizeTargetLang('   ')).toBeUndefined()
  })

  it('forwards the folding option', () => {
    expect(normalizeTargetLang('zh-CN', { foldRegion: false })).toBe('zh-CN')
    expect(normalizeTargetLang('FIL-PH', { foldRegion: false })).toBe('fil-ph')
  })
})
