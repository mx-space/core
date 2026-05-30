import { beforeEach, describe, expect, it } from 'vitest'

import { migrateLegacyProviderType } from './migrate-legacy-provider-type'

beforeEach(() => {
  localStorage.clear()
})

describe('migrateLegacyProviderType', () => {
  it('rewrites top-level provider type from openai to openai-compatible', () => {
    const before = JSON.stringify({
      providers: [
        { id: 'p1', name: '', type: 'openai', apiKey: '', defaultModel: '' },
      ],
    })
    localStorage.setItem('settings.ai.draft', before)
    migrateLegacyProviderType()
    const after = JSON.parse(
      localStorage.getItem('settings.ai.draft') as string,
    )
    expect(after.providers[0].type).toBe('openai-compatible')
  })

  it('rewrites openrouter to openai-compatible', () => {
    localStorage.setItem(
      'settings.ai.providers',
      JSON.stringify([{ type: 'openrouter' }]),
    )
    migrateLegacyProviderType()
    expect(
      JSON.parse(localStorage.getItem('settings.ai.providers') as string),
    ).toEqual([{ type: 'openai-compatible' }])
  })

  it('leaves anthropic/openai-compatible/generic untouched', () => {
    const fixture = JSON.stringify([
      { type: 'anthropic' },
      { type: 'openai-compatible' },
      { type: 'generic' },
    ])
    localStorage.setItem('settings.ai.providers', fixture)
    migrateLegacyProviderType()
    expect(localStorage.getItem('settings.ai.providers')).toBe(fixture)
  })

  it('is a one-shot: re-running does not touch storage again', () => {
    localStorage.setItem(
      'settings.ai.providers',
      JSON.stringify([{ type: 'openai' }]),
    )
    migrateLegacyProviderType()
    const firstPass = localStorage.getItem('settings.ai.providers')
    // pretend an outside source re-introduced a legacy value
    localStorage.setItem(
      'settings.ai.providers',
      JSON.stringify([{ type: 'openai' }]),
    )
    migrateLegacyProviderType()
    expect(localStorage.getItem('settings.ai.providers')).not.toBe(firstPass)
    expect(localStorage.getItem('settings.ai.providers')).toBe(
      JSON.stringify([{ type: 'openai' }]),
    )
  })

  it('skips non-JSON keys without throwing', () => {
    localStorage.setItem('foo', 'not-json-openai')
    expect(() => migrateLegacyProviderType()).not.toThrow()
    expect(localStorage.getItem('foo')).toBe('not-json-openai')
  })

  it('ignores nested type fields on non-provider shapes', () => {
    // Anything literally named "type" with the legacy value gets rewritten —
    // this is the deliberate, conservative rule. Documenting it so callers
    // know to namespace their localStorage if collisions become a concern.
    const value = JSON.stringify({ unrelated: { type: 'openai' } })
    localStorage.setItem('some.key', value)
    migrateLegacyProviderType()
    expect(JSON.parse(localStorage.getItem('some.key') as string)).toEqual({
      unrelated: { type: 'openai-compatible' },
    })
  })
})
