import type { AgentOperation } from '@haklex/rich-agent-core'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

type NodeRecord = SerializedLexicalNode & {
  $?: { blockId?: string }
  children?: SerializedLexicalNode[]
  text?: string
  type?: string
}

export function keepUntouchedBlocks(
  view: SerializedEditorState,
  next: SerializedEditorState,
  operations: AgentOperation[],
): SerializedEditorState {
  const changed = new Set(
    operations.flatMap((operation) =>
      operation.op === 'replace' ? [operation.blockId] : [],
    ),
  )
  const original = new Map<string, SerializedLexicalNode>()
  for (const block of view.root.children) {
    const id = (block as NodeRecord).$?.blockId
    if (id) original.set(id, block)
  }
  return {
    ...next,
    root: {
      ...next.root,
      children: next.root.children.map((block) => {
        const id = (block as NodeRecord).$?.blockId
        return id && !changed.has(id) ? (original.get(id) ?? block) : block
      }),
    },
  }
}

export function focusOf(
  operation: AgentOperation | undefined,
): string | undefined {
  if (!operation) return undefined
  if (operation.op !== 'insert') return operation.blockId
  return (operation.node as NodeRecord).$?.blockId
}

export function extractText(node: SerializedLexicalNode): string {
  const record = node as NodeRecord
  if (typeof record.text === 'string') return record.text
  if (Array.isArray(record.children)) {
    return record.children.map((child) => extractText(child)).join('')
  }
  return ''
}

export function buildOutline(state: SerializedEditorState): string {
  const root = state.root as NodeRecord
  const children = Array.isArray(root.children) ? root.children : []
  const lines = children.map((node) => {
    const record = node as NodeRecord
    const id = record.$?.blockId ?? '-'
    const type = typeof record.type === 'string' ? record.type : 'unknown'
    const preview = extractText(node)
      .replaceAll(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    return `${id} ${type} ${preview}`.trim()
  })
  return ['# /doc.xml outline — ids are XML id attributes', ...lines, ''].join(
    '\n',
  )
}

export function formatExec(result: {
  exitCode: number
  stderr: string
  stdout: string
}) {
  const chunks = [result.stdout, result.stderr].filter((part) => part !== '')
  if (chunks.length > 0) return chunks.join('\n')
  return result.exitCode === 0 ? '' : `exit ${result.exitCode}`
}

export function resolveCommand(params: unknown): string | null {
  const command = (params as { command?: unknown } | null)?.command
  if (typeof command !== 'string' || command.trim() === '') return null
  return command
}
