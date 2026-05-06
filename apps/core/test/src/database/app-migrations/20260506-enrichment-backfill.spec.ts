import { describe, expect, it } from 'vitest'

import { extractFirstUrl } from '~/database/app-migrations/20260506-enrichment-backfill'

describe('extractFirstUrl', () => {
  it('returns null for empty / null / undefined', () => {
    expect(extractFirstUrl(null)).toBeNull()
    expect(extractFirstUrl(undefined)).toBeNull()
    expect(extractFirstUrl('')).toBeNull()
  })

  it('returns null when no http(s) url is present', () => {
    expect(extractFirstUrl('just plain text')).toBeNull()
    expect(extractFirstUrl('ftp://example.com/foo')).toBeNull()
  })

  it('extracts a bare http url', () => {
    expect(extractFirstUrl('http://example.com')).toBe('http://example.com')
    expect(extractFirstUrl('https://example.com/foo/bar')).toBe(
      'https://example.com/foo/bar',
    )
  })

  it('returns the first url when multiple are present', () => {
    expect(
      extractFirstUrl('see https://a.com and https://b.com for more'),
    ).toBe('https://a.com')
  })

  it('extracts a url surrounded by leading text', () => {
    expect(extractFirstUrl('check this: https://example.com')).toBe(
      'https://example.com',
    )
  })

  it('trims trailing ASCII punctuation', () => {
    expect(extractFirstUrl('see https://example.com.')).toBe(
      'https://example.com',
    )
    expect(extractFirstUrl('see https://example.com,')).toBe(
      'https://example.com',
    )
    expect(extractFirstUrl('see (https://example.com)')).toBe(
      'https://example.com',
    )
    expect(extractFirstUrl('see https://example.com!?')).toBe(
      'https://example.com',
    )
  })

  it('trims trailing CJK punctuation', () => {
    expect(extractFirstUrl('看这个 https://example.com。')).toBe(
      'https://example.com',
    )
    expect(extractFirstUrl('链接 https://example.com，')).toBe(
      'https://example.com',
    )
    expect(extractFirstUrl('「https://example.com」')).toBe(
      'https://example.com',
    )
  })

  it('preserves meaningful trailing characters (path, query, fragment)', () => {
    expect(extractFirstUrl('https://example.com/foo/bar')).toBe(
      'https://example.com/foo/bar',
    )
    expect(extractFirstUrl('https://example.com/?q=hi')).toBe(
      'https://example.com/?q=hi',
    )
    expect(extractFirstUrl('https://example.com/#section')).toBe(
      'https://example.com/#section',
    )
  })
})
