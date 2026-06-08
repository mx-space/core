import {
  $toMarkdown,
  allHeadlessNodes,
  sanitizeSerializedJSON,
} from '@haklex/rich-headless'
import { createHeadlessEditor } from '@lexical/headless'

import { EditorProjectionError, UnknownEditorNodeError } from './errors'
import { mxBlockRegistry } from './nodes'
import type { SerializedMxEditorState } from './types'

type RootChild = Record<string, unknown>

function parseEditorState(
  state: SerializedMxEditorState | string,
): SerializedMxEditorState {
  if (typeof state !== 'string') return state
  try {
    return JSON.parse(state) as SerializedMxEditorState
  } catch (error) {
    throw new EditorProjectionError('Invalid serialized editor state JSON', {
      cause: error,
    })
  }
}

function getRootChildren(state: SerializedMxEditorState) {
  if (!state?.root || !Array.isArray(state.root.children)) {
    throw new EditorProjectionError('Serialized editor state root is invalid')
  }
  return state.root.children as RootChild[]
}

function createSegmentState(children: RootChild[]): SerializedMxEditorState {
  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

function toHeadlessMarkdown(children: RootChild[]) {
  if (children.length === 0) return ''

  const editorState = JSON.stringify(createSegmentState(children))
  const sanitized = sanitizeSerializedJSON(editorState, {
    nodes: allHeadlessNodes,
    onUnknown: (type) => {
      throw new UnknownEditorNodeError(type)
    },
  })
  const editor = createHeadlessEditor({
    nodes: allHeadlessNodes,
    onError: (error) => {
      throw error
    },
  })
  try {
    const parsed = editor.parseEditorState(sanitized)
    editor.setEditorState(parsed)
    let markdown = ''
    editor.read(() => {
      markdown = $toMarkdown()
    })
    return markdown
  } catch (error) {
    if (error instanceof EditorProjectionError) throw error
    throw new EditorProjectionError('Failed to project Lexical state', {
      cause: error,
    })
  }
}

function flushSegment(output: string[], pendingHeadlessChildren: RootChild[]) {
  if (pendingHeadlessChildren.length === 0) return
  const markdown = toHeadlessMarkdown(pendingHeadlessChildren)
  if (markdown.trim()) output.push(markdown)
  pendingHeadlessChildren.length = 0
}

export function mxLexicalToMarkdown(
  state: SerializedMxEditorState | string,
): string {
  const parsed = parseEditorState(state)
  const children = getRootChildren(parsed)
  if (children.length === 0) return ''

  const output: string[] = []
  const pendingHeadlessChildren: RootChild[] = []

  for (const child of children) {
    const type = typeof child?.type === 'string' ? child.type : ''
    const projection = mxBlockRegistry[type]

    if (projection) {
      flushSegment(output, pendingHeadlessChildren)
      const markdown = projection.toMarkdown(child as never)
      if (markdown.trim()) output.push(markdown)
      continue
    }

    pendingHeadlessChildren.push(child)
  }

  flushSegment(output, pendingHeadlessChildren)

  return output.join('\n\n')
}
