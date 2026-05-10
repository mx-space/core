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

function stripMarkdownLabel(label: string): string {
  return label
    .replace(/^[-*]\s+/, '')
    .replace(/^(\*\*|__)(.*)\1$/, '$2')
    .replaceAll(/<[^>]+>/g, '')
    .trim()
}

function extractFromMarkdown(source: string | null): PollDefinition[] {
  if (!source) return []

  const out: PollDefinition[] = []
  const blockPattern =
    /<!--\s*haklex:poll\s+({[\s\S]*?})\s*-->([\s\S]*?)<!--\s*\/haklex:poll\s*-->/g

  for (const match of source.matchAll(blockPattern)) {
    const meta = parseJson(match[1] ?? '')
    const body = match[2] ?? ''
    if (!meta || typeof meta !== 'object') continue

    const pollId = (meta as { pollId?: unknown }).pollId
    const mode = (meta as { mode?: unknown }).mode
    if (typeof pollId !== 'string' || !isPollMode(mode)) continue

    const question =
      body
        .split('\n')
        .map((line) => stripMarkdownLabel(line))
        .find((line) => !!line && !line.includes('<!-- id=')) ?? ''

    const options = [...body.matchAll(/^\s*[-*]\s+(.+?)\s*<!--\s*id=([^\s]+)\s*-->/gm)]
      .map((optionMatch) => ({
        label: stripMarkdownLabel(optionMatch[1] ?? ''),
        id: optionMatch[2] ?? '',
      }))
      .filter((option) => option.id && option.label)

    out.push({
      pollId,
      question,
      options,
      mode,
      ...(typeof (meta as { closeAt?: unknown }).closeAt === 'string'
        ? { closeAt: (meta as { closeAt: string }).closeAt }
        : {}),
      ...(isPollShowResults((meta as { showResults?: unknown }).showResults)
        ? { showResults: (meta as { showResults: PollShowResults }).showResults }
        : {}),
    })
  }

  return out
}

export function extractPollDefinitions(input: {
  content: string | null
  text?: string | null
  contentFormat: string
}): PollDefinition[] {
  if (input.contentFormat === ContentFormat.Lexical) {
    return extractFromLexical(input.content)
  }

  return extractFromMarkdown(input.content ?? input.text ?? null)
}

export function isPollClosed(definition: Pick<PollDefinition, 'closeAt'>): boolean {
  if (!definition.closeAt) return false
  const closeAt = new Date(definition.closeAt)
  if (Number.isNaN(closeAt.getTime())) return false
  return closeAt.getTime() <= Date.now()
}
