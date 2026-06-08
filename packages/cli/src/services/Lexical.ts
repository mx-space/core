import {
  deserializeMxLitexmlToLexical,
  mxLexicalToMarkdown,
  serializeMxLexicalToLitexml,
  stripMxLitexmlDocWrapper,
} from '@mx-space/editor'
import { Context, Effect, Layer } from 'effect'

import { ValidationXml } from '../domain/errors'

export interface LexicalState {
  readonly root: {
    readonly type: 'root'
    readonly children: ReadonlyArray<unknown>
    readonly direction?: 'ltr' | 'rtl' | null
    readonly format?: string
    readonly indent?: number
    readonly version?: number
  }
}

export interface LexicalService {
  /** Parse LiteXML into a Lexical editor state. */
  readonly litexmlToPayload: (
    xml: string,
  ) => Effect.Effect<LexicalState, ValidationXml>
  /** Serialize a Lexical editor state back to LiteXML. */
  readonly payloadToLitexml: (
    state: LexicalState,
  ) => Effect.Effect<string, ValidationXml>
  /** Derive a Markdown rendering from a Lexical state (used for `--output llm`). */
  readonly lexicalJsonToMarkdown: (
    state: LexicalState,
  ) => Effect.Effect<string, ValidationXml>
  /** Convenience: a blank Lexical state for new-document scaffolds. */
  readonly emptyState: Effect.Effect<LexicalState>
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

const makeService = (): LexicalService => ({
  litexmlToPayload: (xml) =>
    Effect.try({
      try: () => {
        const wrapped = xml.includes('<doc') ? xml : `<doc>${xml}</doc>`
        return deserializeMxLitexmlToLexical(wrapped) as LexicalState
      },
      catch: (err) =>
        new ValidationXml({
          message: `failed to parse LiteXML: ${messageOf(err)}`,
          cause: err,
        }),
    }),

  payloadToLitexml: (state) =>
    Effect.try({
      try: () => {
        const xml = serializeMxLexicalToLitexml(state as any, {
          compact: false,
        })
        return stripMxLitexmlDocWrapper(xml).trim()
      },
      catch: (err) =>
        new ValidationXml({
          message: `failed to serialize Lexical state: ${messageOf(err)}`,
          cause: err,
        }),
    }),

  lexicalJsonToMarkdown: (state) =>
    Effect.try({
      try: () => {
        return mxLexicalToMarkdown(state)
      },
      catch: (err) =>
        new ValidationXml({
          message: `failed to render Markdown: ${messageOf(err)}`,
          cause: err,
        }),
    }),

  emptyState: Effect.sync(
    (): LexicalState => ({
      root: {
        type: 'root',
        children: [],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    }),
  ),
})

export class Lexical extends Context.Tag('Lexical')<Lexical, LexicalService>() {
  static Default: Layer.Layer<Lexical> = Layer.succeed(Lexical, makeService())
}
