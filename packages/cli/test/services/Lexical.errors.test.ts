import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const richLitexmlMock = vi.hoisted(() => ({
  createDefaultRegistry: vi.fn(() => ({})),
  deserializeFromXml: vi.fn(),
  serializeToXml: vi.fn(),
}))

const richHeadlessMock = vi.hoisted(() => ({
  sanitizeSerializedJSON: vi.fn((value: string) => value),
  toMarkdown: vi.fn(() => ''),
}))

vi.mock('@haklex/rich-litexml', () => ({
  createDefaultRegistry: richLitexmlMock.createDefaultRegistry,
  deserializeFromXml: richLitexmlMock.deserializeFromXml,
  serializeToXml: richLitexmlMock.serializeToXml,
}))

vi.mock('@haklex/rich-headless', () => ({
  allHeadlessNodes: [],
  sanitizeSerializedJSON: richHeadlessMock.sanitizeSerializedJSON,
  $toMarkdown: richHeadlessMock.toMarkdown,
}))

vi.mock('@lexical/headless', () => ({
  createHeadlessEditor: () => ({
    parseEditorState: () => ({}),
    read: (fn: () => void) => fn(),
    setEditorState: () => undefined,
  }),
}))

import { Lexical } from '../../src/services/Lexical'

describe('Lexical service dependency failures', () => {
  beforeEach(() => {
    richLitexmlMock.createDefaultRegistry.mockReturnValue({})
    richLitexmlMock.deserializeFromXml.mockReturnValue({
      root: { type: 'root', children: [] },
    })
    richLitexmlMock.serializeToXml.mockReturnValue('<doc />')
    richHeadlessMock.sanitizeSerializedJSON.mockImplementation(
      (value: string) => value,
    )
    richHeadlessMock.toMarkdown.mockReturnValue('')
  })

  it('maps LiteXML parse dependency failures to ValidationXml', async () => {
    richLitexmlMock.deserializeFromXml.mockImplementation(() => {
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
    richLitexmlMock.serializeToXml.mockImplementation(() => {
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
    richHeadlessMock.sanitizeSerializedJSON.mockImplementation(() => {
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
