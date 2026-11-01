import type { RevisionSnapshot } from '~/models/draft'

export type SummaryBlock =
  | { before: string; kind: 'changed'; text: string }
  | { kind: 'added' | 'fresh' | 'removed'; text: string }

export interface DraftChangeSummary {
  added: number
  blocks: SummaryBlock[]
  changed: number
  fresh: boolean
  otherChanges: boolean
  removed: number
  wordDelta: number
}

interface Block {
  id: string | null
  signature: string
  text: string
}

interface LexicalNode {
  $?: { blockId?: unknown }
  children?: LexicalNode[]
  text?: unknown
  type?: string
}

const PREVIEW_BLOCKS = 4

export function summarizeDraftChanges(
  published: RevisionSnapshot | null,
  draft: RevisionSnapshot,
): DraftChangeSummary {
  const after = toBlocks(draft)
  const wordsAfter = countWords(after)
  if (!published) {
    return {
      added: 0,
      blocks: after
        .slice(0, PREVIEW_BLOCKS)
        .map((block) => ({ kind: 'fresh', text: block.text })),
      changed: 0,
      fresh: true,
      otherChanges: false,
      removed: 0,
      wordDelta: wordsAfter,
    }
  }
  const before = toBlocks(published)
  const pairedById =
    published.contentFormat === 'lexical' &&
    draft.contentFormat === 'lexical' &&
    after.some((block) => block.id) &&
    before.some((block) => block.id)
  const blocks = pairedById
    ? pairById(before, after)
    : pairBySequence(before, after)
  const count = (kind: SummaryBlock['kind']) =>
    blocks.filter((block) => block.kind === kind).length
  return {
    added: count('added'),
    blocks: blocks.slice(0, PREVIEW_BLOCKS),
    changed: count('changed'),
    fresh: false,
    otherChanges:
      blocks.length === 0 && fingerprint(published) !== fingerprint(draft),
    removed: count('removed'),
    wordDelta: wordsAfter - countWords(before),
  }
}

function pairById(before: Block[], after: Block[]): SummaryBlock[] {
  const previous = new Map(
    before.flatMap((block) => (block.id ? [[block.id, block] as const] : [])),
  )
  const result: SummaryBlock[] = []
  for (const block of after) {
    const match = block.id ? previous.get(block.id) : undefined
    if (!match) result.push({ kind: 'added', text: block.text })
    else if (match.signature !== block.signature)
      result.push({ before: match.text, kind: 'changed', text: block.text })
  }
  const current = new Set(after.map((block) => block.id))
  for (const block of before) {
    if (!block.id || !current.has(block.id))
      result.push({ kind: 'removed', text: block.text })
  }
  return result
}

function pairBySequence(before: Block[], after: Block[]): SummaryBlock[] {
  const a = before.map((block) => block.signature)
  const b = after.map((block) => block.signature)
  const lcs = Array.from({ length: a.length + 1 }, () =>
    Array.from<number>({ length: b.length + 1 }).fill(0),
  )
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const result: SummaryBlock[] = []
  let removed: Block[] = []
  let added: Block[] = []
  const flush = () => {
    const paired = Math.min(removed.length, added.length)
    for (let k = 0; k < paired; k++)
      result.push({
        before: removed[k].text,
        kind: 'changed',
        text: added[k].text,
      })
    for (const block of added.slice(paired))
      result.push({ kind: 'added', text: block.text })
    for (const block of removed.slice(paired))
      result.push({ kind: 'removed', text: block.text })
    removed = []
    added = []
  }
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush()
      i++
      j++
    } else if (
      j < b.length &&
      (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])
    ) {
      added.push(after[j++])
    } else {
      removed.push(before[i++])
    }
  }
  flush()
  return result
}

function toBlocks(revision: RevisionSnapshot): Block[] {
  if (revision.contentFormat === 'lexical' && revision.content) {
    const nodes = parseLexicalBlocks(revision.content)
    if (nodes) return nodes
  }
  return (revision.text || revision.content || '')
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((text) => ({ id: null, signature: text, text }))
}

function parseLexicalBlocks(content: string): Block[] | null {
  try {
    const children = (JSON.parse(content) as { root?: LexicalNode }).root
      ?.children
    if (!Array.isArray(children)) return null
    return children.map((node) => {
      const text = collectText(node).replaceAll(/\s+/g, ' ').trim()
      const id = typeof node.$?.blockId === 'string' ? node.$.blockId : null
      return {
        id,
        signature: text || JSON.stringify(node, withoutState),
        text: text || `[${node.type ?? 'block'}]`,
      }
    })
  } catch {
    return null
  }
}

function fingerprint(revision: RevisionSnapshot) {
  return JSON.stringify(
    {
      content: revision.content ? safeParse(revision.content) : null,
      images: revision.images,
      meta: revision.meta,
      text: revision.text,
      title: revision.title,
      typeSpecificData: revision.typeSpecificData,
    },
    withoutState,
  )
}

function safeParse(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}

function withoutState(key: string, value: unknown) {
  return key === '$' ? undefined : value
}

function isInline(value: unknown) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray((value as LexicalNode).children),
  )
}

function collectText(value: unknown): string {
  if (Array.isArray(value))
    return value.map(collectText).join(value.every(isInline) ? '' : ' ')
  if (!value || typeof value !== 'object') return ''
  const node = value as LexicalNode & Record<string, unknown>
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  return Object.entries(node)
    .filter(([key]) => key !== '$')
    .map(([, child]) => collectText(child))
    .filter(Boolean)
    .join(' ')
}

function countWords(blocks: Block[]) {
  let total = 0
  for (const block of blocks) {
    if (block.text.startsWith('[') && block.text.endsWith(']')) continue
    total += block.text.match(/\p{Script=Han}/gu)?.length ?? 0
    total += block.text.match(/[A-Z0-9]+(?:['’-][A-Z0-9]+)*/gi)?.length ?? 0
  }
  return total
}
