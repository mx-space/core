import {
  $toMarkdown,
  allHeadlessNodes,
  sanitizeSerializedJSON,
} from '@haklex/rich-headless'
import {
  createDefaultRegistry,
  deserializeFromXml,
  serializeToXml,
} from '@haklex/rich-litexml'
import { createHeadlessEditor } from '@lexical/headless'
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

// Single shared registry to avoid re-initialising node tables on every call.
let cachedRegistry: ReturnType<typeof createDefaultRegistry> | null = null
const getRegistry = () => {
  if (!cachedRegistry) cachedRegistry = createDefaultRegistry()
  return cachedRegistry
}

const stripDocWrapper = (xml: string): string => {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<doc>') && trimmed.endsWith('</doc>')) {
    return trimmed.slice('<doc>'.length, trimmed.length - '</doc>'.length)
  }
  return trimmed
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
        return deserializeFromXml(wrapped, getRegistry()) as LexicalState
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
        const xml = serializeToXml(state as any, getRegistry(), {
          compact: false,
        })
        return stripDocWrapper(xml).trim()
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
        const editor = createHeadlessEditor({
          nodes: allHeadlessNodes,
          onError: (err) => {
            throw err
          },
        })
        const serialized = JSON.stringify(state)
        const sanitized = sanitizeSerializedJSON(serialized, {
          nodes: allHeadlessNodes,
        })
        const parsed = editor.parseEditorState(sanitized)
        editor.setEditorState(parsed)
        let markdown = ''
        editor.read(() => {
          markdown = $toMarkdown()
        })
        return markdown
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
