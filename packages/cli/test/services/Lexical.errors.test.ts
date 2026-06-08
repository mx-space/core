import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const editorMock = vi.hoisted(() => ({
  deserializeMxLitexmlToLexical: vi.fn(),
  mxLexicalToMarkdown: vi.fn(() => ''),
  serializeMxLexicalToLitexml: vi.fn(),
  stripMxLitexmlDocWrapper: vi.fn((xml: string) => xml),
}))

vi.mock('@mx-space/editor', () => ({
  deserializeMxLitexmlToLexical: editorMock.deserializeMxLitexmlToLexical,
  mxLexicalToMarkdown: editorMock.mxLexicalToMarkdown,
  serializeMxLexicalToLitexml: editorMock.serializeMxLexicalToLitexml,
  stripMxLitexmlDocWrapper: editorMock.stripMxLitexmlDocWrapper,
}))

import { Lexical } from '../../src/services/Lexical'

describe('Lexical service dependency failures', () => {
  beforeEach(() => {
    editorMock.deserializeMxLitexmlToLexical.mockReturnValue({
      root: { type: 'root', children: [] },
    })
    editorMock.serializeMxLexicalToLitexml.mockReturnValue('<doc />')
    editorMock.stripMxLitexmlDocWrapper.mockImplementation((xml: string) => xml)
    editorMock.mxLexicalToMarkdown.mockReturnValue('')
  })

  it('maps LiteXML parse dependency failures to ValidationXml', async () => {
    editorMock.deserializeMxLitexmlToLexical.mockImplementation(() => {
      throw 'parse failed'
    })
    const err = await Effect.runPromise(
      Effect.gen(function* () {
        const lexical = yield* Lexical
        return yield* Effect.flip(lexical.litexmlToPayload('<p>x</p>'))
      }).pipe(Effect.provide(Lexical.Default)),
    )
    expect(err._tag).toBe('ValidationXml')
    expect(err.message).toContain('failed to parse LiteXML')
  })

  it('maps LiteXML serialization dependency failures to ValidationXml', async () => {
    editorMock.serializeMxLexicalToLitexml.mockImplementation(() => {
      throw new Error('serialize failed')
    })
    const err = await Effect.runPromise(
      Effect.gen(function* () {
        const lexical = yield* Lexical
        return yield* Effect.flip(
          lexical.payloadToLitexml({ root: { type: 'root', children: [] } }),
        )
      }).pipe(Effect.provide(Lexical.Default)),
    )
    expect(err._tag).toBe('ValidationXml')
    expect(err.message).toContain('failed to serialize Lexical state')
  })

  it('maps Markdown rendering dependency failures to ValidationXml', async () => {
    editorMock.mxLexicalToMarkdown.mockImplementation(() => {
      throw { message: 'sanitize failed' }
    })
    const err = await Effect.runPromise(
      Effect.gen(function* () {
        const lexical = yield* Lexical
        return yield* Effect.flip(
          lexical.lexicalJsonToMarkdown({
            root: { type: 'root', children: [] },
          }),
        )
      }).pipe(Effect.provide(Lexical.Default)),
    )
    expect(err._tag).toBe('ValidationXml')
    expect(err.message).toContain('failed to render Markdown')
  })
})
