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

import { MxsError } from './errors'

export interface LexicalState {
  root: {
    type: 'root'
    children: unknown[]
    direction?: 'ltr' | 'rtl' | null
    format?: string
    indent?: number
    version?: number
  }
}

let cachedRegistry: ReturnType<typeof createDefaultRegistry> | null = null

function getRegistry() {
  if (!cachedRegistry) cachedRegistry = createDefaultRegistry()
  return cachedRegistry
}

export function parseToLexical(xml: string): LexicalState {
  const wrapped = xml.includes('<doc') ? xml : `<doc>${xml}</doc>`
  try {
    return deserializeFromXml(wrapped, getRegistry()) as LexicalState
  } catch (err: any) {
    throw new MxsError({
      code: 'validation.xml',
      message: `failed to parse LiteXML: ${err?.message ?? err}`,
      cause: err,
    })
  }
}

export function serializeFromLexical(state: LexicalState): string {
  const xml = serializeToXml(state as any, getRegistry(), { compact: false })
  return stripDocWrapper(xml).trim()
}

function stripDocWrapper(xml: string): string {
  const trimmed = xml.trim()
  if (trimmed.startsWith('<doc>') && trimmed.endsWith('</doc>')) {
    return trimmed.slice('<doc>'.length, trimmed.length - '</doc>'.length)
  }
  return trimmed
}

export function deriveTextFromLexical(state: LexicalState): string {
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
}

export function emptyLexicalState(): LexicalState {
  return {
    root: {
      type: 'root',
      children: [],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
