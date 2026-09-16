import type { AgentOperation } from '@haklex/rich-agent-core'
import { serializeMxLexicalToLitexml } from '@mx-space/editor'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

type NodeRecord = SerializedLexicalNode & {
  $?: { blockId?: string }
  children?: SerializedLexicalNode[]
}

export type DiffDocumentSuccess = {
  mintedIds: string[]
  nextState: SerializedEditorState
  ok: true
  operations: AgentOperation[]
}

export type DiffDocumentFailure = {
  error: 'ids_stripped'
  message: string
  ok: false
}

export type DiffDocumentResult = DiffDocumentFailure | DiffDocumentSuccess

function getBlockId(node: SerializedLexicalNode): string | undefined {
  const id = (node as NodeRecord).$?.blockId
  return typeof id === 'string' && id !== '' ? id : undefined
}

function withBlockId(
  node: SerializedLexicalNode,
  blockId: string,
): SerializedLexicalNode {
  const record = node as NodeRecord
  return {
    ...record,
    $: { ...record.$, blockId },
  } as SerializedLexicalNode
}

function fingerprint(node: SerializedLexicalNode): string {
  const state = {
    root: {
      children: [node],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as SerializedEditorState
  return serializeMxLexicalToLitexml(state, { compact: true })
}

function mintBlockId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 21)
}

function rootChildren(state: SerializedEditorState): SerializedLexicalNode[] {
  const root = state.root as NodeRecord
  return Array.isArray(root.children) ? root.children : []
}

function longestCommonSubsequence(
  left: string[],
  right: string[],
): Set<string> {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  )
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      table[i][j] =
        left[i - 1] === right[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1])
    }
  }
  const seq: string[] = []
  let i = left.length
  let j = right.length
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      seq.push(left[i - 1])
      i -= 1
      j -= 1
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      i -= 1
    } else {
      j -= 1
    }
  }
  return new Set(seq.toReversed())
}

function assignMissingIds(
  nodes: SerializedLexicalNode[],
  used: Set<string>,
): { mintedIds: string[]; nodes: SerializedLexicalNode[] } {
  const mintedIds: string[] = []
  const next = nodes.map((node) => {
    const existing = getBlockId(node)
    if (existing) return node
    let id = mintBlockId()
    while (used.has(id)) id = mintBlockId()
    used.add(id)
    mintedIds.push(id)
    return withBlockId(node, id)
  })
  return { mintedIds, nodes: next }
}

export function diffDocumentStates(
  base: SerializedEditorState,
  next: SerializedEditorState,
): DiffDocumentResult {
  const baseNodes = rootChildren(base)
  const rawNextNodes = rootChildren(next)
  const originalIds = baseNodes
    .map((node) => getBlockId(node))
    .filter((id): id is string => Boolean(id))
  const nextExistingIds = rawNextNodes
    .map((node) => getBlockId(node))
    .filter((id): id is string => Boolean(id))
  const kept = originalIds.filter((id) => nextExistingIds.includes(id)).length
  const similarLength =
    Math.abs(rawNextNodes.length - baseNodes.length) <=
    Math.max(2, Math.ceil(baseNodes.length * 0.2))

  if (
    originalIds.length >= 2 &&
    similarLength &&
    kept / originalIds.length < 0.5
  ) {
    return {
      error: 'ids_stripped',
      message:
        'Too many original block ids were dropped. Restore id attributes from /doc.xml and retry.',
      ok: false,
    }
  }

  const used = new Set([...originalIds, ...nextExistingIds])
  const assigned = assignMissingIds(rawNextNodes, used)
  const nextNodes = assigned.nodes
  const nextState: SerializedEditorState = {
    ...next,
    root: {
      ...(next.root as NodeRecord),
      children: nextNodes,
    } as SerializedEditorState['root'],
  }

  const baseIds = originalIds
  const nextIds = nextNodes.map((node) => getBlockId(node)!)
  const lcs = longestCommonSubsequence(baseIds, nextIds)
  const baseById = new Map(
    baseNodes
      .map((node) => [getBlockId(node), node] as const)
      .filter((entry): entry is readonly [string, SerializedLexicalNode] =>
        Boolean(entry[0]),
      ),
  )

  const operations: AgentOperation[] = []

  for (const id of baseIds) {
    if (!lcs.has(id)) operations.push({ blockId: id, op: 'delete' })
  }

  let lastKeptId: string | null = null
  for (let index = 0; index < nextNodes.length; index++) {
    const node = nextNodes[index]
    const id = getBlockId(node)!
    if (!lcs.has(id)) {
      operations.push({
        node,
        op: 'insert',
        position: lastKeptId
          ? { blockId: lastKeptId, type: 'after' }
          : { index, type: 'root' },
      })
      continue
    }
    lastKeptId = id
    const original = baseById.get(id)
    if (original && fingerprint(original) !== fingerprint(node)) {
      operations.push({
        blockId: id,
        node: withBlockId(node, id),
        op: 'replace',
      })
    }
  }

  return {
    mintedIds: assigned.mintedIds,
    nextState,
    ok: true,
    operations,
  }
}
