import { ContentFormat } from '~/shared/types/content-format.type'

import type {
  PollDefinition,
  PollMode,
  PollShowResults,
} from './poll-definition.types'

interface MaybeSerializedPollNode {
  children?: MaybeSerializedPollNode[]
  closeAt?: unknown
  content?: SerializedEditorState
  mode?: unknown
  options?: unknown
  pollId?: unknown
  question?: unknown
  showResults?: unknown
  type?: unknown
}

interface SerializedEditorState {
  root?: {
    children?: MaybeSerializedPollNode[]
  }
}

const VALID_SHOW_RESULTS = new Set<PollShowResults>([
  'always',
  'after-vote',
  'after-close',
])

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isPollMode(value: unknown): value is PollMode {
  return value === 'single' || value === 'multiple'
}

function isPollShowResults(value: unknown): value is PollShowResults {
  return typeof value === 'string' && VALID_SHOW_RESULTS.has(value as any)
}

function coercePollDefinition(node: MaybeSerializedPollNode): PollDefinition | null {
  if (node.type !== 'poll') return null
  if (typeof node.pollId !== 'string' || typeof node.question !== 'string') {
    return null
  }
  if (!isPollMode(node.mode) || !Array.isArray(node.options)) return null

  const options = node.options
    .filter(
      (option): option is { id: string; label: string } =>
        !!option &&
        typeof option === 'object' &&
        typeof (option as { id?: unknown }).id === 'string' &&
        typeof (option as { label?: unknown }).label === 'string',
    )
    .map((option) => ({
      id: option.id,
      label: option.label,
    }))

  return {
    pollId: node.pollId,
    question: node.question,
    options,
    mode: node.mode,
    ...(typeof node.closeAt === 'string' && node.closeAt
      ? { closeAt: node.closeAt }
      : {}),
    ...(isPollShowResults(node.showResults)
      ? { showResults: node.showResults }
      : {}),
  }
}

function walkLexicalNode(
  node: MaybeSerializedPollNode,
  out: PollDefinition[],
): void {
  const definition = coercePollDefinition(node)
  if (definition) {
    out.push(definition)
    return
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) walkLexicalNode(child, out)
  }

  if (node.content?.root?.children) {
    for (const child of node.content.root.children) walkLexicalNode(child, out)
  }
}

function extractFromLexical(content: string | null): PollDefinition[] {
  if (!content) return []
  const parsed = parseJson(content) as SerializedEditorState | null
  if (!Array.isArray(parsed?.root?.children)) return []

  const out: PollDefinition[] = []
  for (const child of parsed.root.children) walkLexicalNode(child, out)
  return out
}

export function extractPollDefinitions(input: {
  content: string | null
  contentFormat: string
}): PollDefinition[] {
  if (input.contentFormat === ContentFormat.Lexical) {
    return extractFromLexical(input.content)
  }

  return []
}

export function isPollClosed(definition: Pick<PollDefinition, 'closeAt'>): boolean {
  if (!definition.closeAt) return false
  const closeAt = new Date(definition.closeAt)
  if (Number.isNaN(closeAt.getTime())) return false
  return closeAt.getTime() <= Date.now()
}
