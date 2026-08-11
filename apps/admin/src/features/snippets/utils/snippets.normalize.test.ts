import { describe, expect, it } from 'vitest'

import { SnippetType } from '~/models/snippet'

import { normalizeSnippetRawForSave } from './snippets'

describe('normalizeSnippetRawForSave', () => {
  it('keeps JSON snippets readable after saving', () => {
    const raw = '{"name":"Mix Space","nested":{"enabled":true}}'

    expect(normalizeSnippetRawForSave(SnippetType.JSON, raw, (key) => key))
      .toBe(`{
  "name": "Mix Space",
  "nested": {
    "enabled": true
  }
}`)
  })

  it('reports invalid JSON without changing the validation behavior', () => {
    expect(() =>
      normalizeSnippetRawForSave(SnippetType.JSON, '{', (key) => key),
    ).toThrow('snippets.error.jsonInvalid')
  })
})
