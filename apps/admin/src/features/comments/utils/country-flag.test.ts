// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { countryFlag } from './country-flag'

const FALLBACK = '🏳️'

describe('countryFlag', () => {
  it('converts a lowercase ISO-3166 alpha-2 code to the flag emoji', () => {
    expect(countryFlag('cn')).toBe('🇨🇳')
  })

  it('converts an uppercase ISO-3166 alpha-2 code to the flag emoji', () => {
    expect(countryFlag('US')).toBe('🇺🇸')
  })

  it('trims surrounding whitespace before conversion', () => {
    expect(countryFlag(' jp ')).toBe('🇯🇵')
  })

  it('returns the fallback for undefined input', () => {
    expect(countryFlag(undefined)).toBe(FALLBACK)
  })

  it('returns the fallback for an empty string', () => {
    expect(countryFlag('')).toBe(FALLBACK)
  })

  it('returns the fallback for a code that is not length 2', () => {
    expect(countryFlag('USA')).toBe(FALLBACK)
    expect(countryFlag('A')).toBe(FALLBACK)
  })

  it('returns the fallback for non-letter input', () => {
    expect(countryFlag('1A')).toBe(FALLBACK)
    expect(countryFlag('--')).toBe(FALLBACK)
  })
})
