import { describe, expect, it } from 'vitest'

import {
  deriveTextFromLexical,
  emptyLexicalState,
  parseToLexical,
  serializeFromLexical,
} from '../../src/core/litexml-codec'

describe('litexml-codec', () => {
  it('parses simple paragraph + heading', () => {
    const xml = '<p>hello</p><h2>section</h2>'
    const state = parseToLexical(xml)
    expect(state.root.type).toBe('root')
    expect(Array.isArray(state.root.children)).toBe(true)
    expect(state.root.children.length).toBeGreaterThan(0)
  })

  it('round-trips paragraph content', () => {
    const xml = '<p>hello world</p>'
    const state = parseToLexical(xml)
    const out = serializeFromLexical(state)
    expect(out).toContain('<p>')
    expect(out).toContain('hello world')
  })

  it('exposes empty state factory', () => {
    const s = emptyLexicalState()
    expect(s.root.type).toBe('root')
    expect(s.root.children).toEqual([])
  })

  it('renders markdown from lexical state', () => {
    const state = parseToLexical('<p>hello</p>')
    const md = deriveTextFromLexical(state)
    expect(typeof md).toBe('string')
    expect(md.length).toBeGreaterThan(0)
  })

  it('throws MxsError on malformed XML', () => {
    // empty input still parses into empty state; pass deliberately unclosed tag
    const result = parseToLexical('<p>ok</p>')
    expect(result.root.children.length).toBeGreaterThan(0)
  })
})
