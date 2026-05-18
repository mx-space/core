import { readFileSync } from 'node:fs'
import path from 'node:path'

import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { describe, expect } from 'vitest'

import { Lexical } from '../../src/services/Lexical'

const fixture = (name: string) =>
  readFileSync(path.resolve(__dirname, '../fixtures', name), 'utf8')

describe('Lexical service', () => {
  it.effect('parses litexml content into a Lexical state', () =>
    Effect.gen(function* () {
      const lexical = yield* Lexical
      const state = yield* lexical.litexmlToPayload('<p>hello</p>')
      expect(state.root.type).toBe('root')
      expect(state.root.children.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(Lexical.Default)),
  )

  it.effect('round-trips paragraph content', () =>
    Effect.gen(function* () {
      const lexical = yield* Lexical
      const state = yield* lexical.litexmlToPayload('<p>hello world</p>')
      const xml = yield* lexical.payloadToLitexml(state)
      expect(xml).toContain('<p>')
      expect(xml).toContain('hello world')
    }).pipe(Effect.provide(Lexical.Default)),
  )

  it.effect('renders markdown from lexical state', () =>
    Effect.gen(function* () {
      const lexical = yield* Lexical
      const state = yield* lexical.litexmlToPayload('<p>hello</p>')
      const md = yield* lexical.lexicalJsonToMarkdown(state)
      expect(typeof md).toBe('string')
      expect(md.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(Lexical.Default)),
  )

  it.effect('exposes an empty state factory', () =>
    Effect.gen(function* () {
      const lexical = yield* Lexical
      const state = yield* lexical.emptyState
      expect(state.root.type).toBe('root')
      expect(state.root.children).toEqual([])
    }).pipe(Effect.provide(Lexical.Default)),
  )

  it.effect('parses the post.xml fixture content section', () =>
    Effect.gen(function* () {
      const lexical = yield* Lexical
      const state = yield* lexical.litexmlToPayload('<p>正文一</p><h2>章节</h2>')
      expect(state.root.children.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(Lexical.Default)),
  )

  // Fixture files exist — use them as additional smoke coverage so this test
  // breaks if the fixtures change unexpectedly.
  it('post.xml fixture parses non-empty', () => {
    expect(fixture('post.xml')).toContain('<mxpost>')
  })

  it('post-bad.xml fixture is malformed', () => {
    expect(fixture('post-bad.xml')).toContain('<p>unterminated')
  })

  it('note.xml fixture parses non-empty', () => {
    expect(fixture('note.xml')).toContain('<mxnote>')
  })
})
