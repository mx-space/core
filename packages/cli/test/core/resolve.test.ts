import { describe, expect, it } from 'vitest'

import {
  fuzzySuggest,
  isSnowflakeId,
  levenshtein,
  matchItem,
  NameResolver,
} from '../../src/core/resolve'
import { MxsErrorCode } from '../../src/core/errors'

describe('isSnowflakeId', () => {
  it('matches 15+ digit numerics', () => {
    expect(isSnowflakeId('123456789012345')).toBe(true)
    expect(isSnowflakeId('1234567890123456789')).toBe(true)
  })
  it('rejects short numerics and strings', () => {
    expect(isSnowflakeId('123')).toBe(false)
    expect(isSnowflakeId('tech')).toBe(false)
  })
})

describe('matchItem', () => {
  const items = [
    { id: 'i1', slug: 'tech', name: '技术' },
    { id: 'i2', slug: 'life', name: 'Life' },
  ]
  it('matches by slug first', () => {
    expect(matchItem(items, 'tech')?.id).toBe('i1')
  })
  it('matches by name', () => {
    expect(matchItem(items, '技术')?.id).toBe('i1')
  })
  it('matches case-insensitive name', () => {
    expect(matchItem(items, 'life')?.id).toBe('i2')
    expect(matchItem(items, 'LIFE')?.id).toBe('i2')
  })
  it('returns null on miss', () => {
    expect(matchItem(items, 'nope')).toBeNull()
  })
})

describe('levenshtein', () => {
  it('returns 0 for identical', () => {
    expect(levenshtein('foo', 'foo')).toBe(0)
  })
  it('returns 1 for one-edit', () => {
    expect(levenshtein('foo', 'fo')).toBe(1)
    expect(levenshtein('foo', 'goo')).toBe(1)
  })
  it('returns string length when other empty', () => {
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })
})

describe('fuzzySuggest', () => {
  it('suggests close names', () => {
    const items = [
      { id: 'i1', slug: 'tech', name: 'Tech' },
      { id: 'i2', slug: 'life', name: 'Life' },
    ]
    const suggestions = fuzzySuggest(items, 'tch')
    expect(suggestions).toContain('Tech')
  })
  it('returns empty when nothing close', () => {
    const items = [{ id: 'i1', slug: 'tech', name: 'Tech' }]
    expect(fuzzySuggest(items, 'completely-different')).toEqual([])
  })
})

describe('NameResolver', () => {
  it('returns id directly for snowflake', async () => {
    const resolver = new NameResolver({
      fetchCategories: async () => [],
    })
    const id = '1234567890123456789'
    expect(await resolver.resolveCategory(id)).toBe(id)
  })

  it('caches fetcher result within ttl', async () => {
    let calls = 0
    const resolver = new NameResolver({
      fetchCategories: async () => {
        calls++
        return [{ id: 'i1', slug: 'tech', name: 'Tech' }]
      },
    })
    await resolver.resolveCategory('tech')
    await resolver.resolveCategory('Tech')
    expect(calls).toBe(1)
  })

  it('throws with fuzzy suggestions on miss', async () => {
    const resolver = new NameResolver({
      fetchCategories: async () => [
        { id: 'i1', slug: 'tech', name: 'Tech' },
      ],
    })
    await expect(resolver.resolveCategory('tch')).rejects.toMatchObject({
      code: MxsErrorCode.ValidationFailed,
    })
  })
})
