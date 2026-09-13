import type { LexicalState } from '../../services/Lexical'
import { diffLines } from './document'

type Block = Record<string, unknown>

export type DiffNoteOp = 'insert' | 'replace' | 'delete'

interface DiffNoteBlock extends Block {
  type: 'agent-diff'
  version: 2
  batchId: string
  diffEntryId: string
  opType: DiffNoteOp
  originalNode: Block | null
  proposedNode: Block | null
}

const BATCH_ID = 'mxs-author'

const isDiffNote = (block: unknown): block is DiffNoteBlock =>
  typeof block === 'object' &&
  block !== null &&
  (block as Block).type === 'agent-diff'

const diffNote = (
  index: number,
  opType: DiffNoteOp,
  originalNode: Block | null,
  proposedNode: Block | null,
): DiffNoteBlock => ({
  type: 'agent-diff',
  version: 2,
  batchId: BATCH_ID,
  diffEntryId: `${BATCH_ID}-${index}`,
  opType,
  originalNode,
  proposedNode,
})

const withChildren = (
  state: LexicalState,
  children: ReadonlyArray<unknown>,
): LexicalState => ({ ...state, root: { ...state.root, children } })

export function annotateDiffNotes(
  base: LexicalState,
  next: LexicalState,
): LexicalState {
  const baseBlocks = base.root.children as Block[]
  const nextBlocks = next.root.children as Block[]
  const ops = diffLines(
    baseBlocks.map((b) => JSON.stringify(b)),
    nextBlocks.map((b) => JSON.stringify(b)),
  )

  const out: unknown[] = []
  let bi = 0
  let ni = 0
  let entry = 0
  let i = 0
  while (i < ops.length) {
    if (ops[i]![0] === 'eq') {
      out.push(nextBlocks[ni])
      bi++
      ni++
      i++
      continue
    }
    const dels: Block[] = []
    const adds: Block[] = []
    while (i < ops.length && ops[i]![0] !== 'eq') {
      if (ops[i]![0] === 'del') dels.push(baseBlocks[bi++]!)
      else adds.push(nextBlocks[ni++]!)
      i++
    }
    const paired = Math.min(dels.length, adds.length)
    for (let k = 0; k < paired; k++) {
      out.push(diffNote(entry++, 'replace', dels[k]!, adds[k]!))
    }
    for (let k = paired; k < dels.length; k++) {
      out.push(diffNote(entry++, 'delete', dels[k]!, null))
    }
    for (let k = paired; k < adds.length; k++) {
      out.push(diffNote(entry++, 'insert', null, adds[k]!))
    }
  }
  return withChildren(next, out)
}

const isLexicalState = (value: unknown): value is LexicalState =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as { root?: { children?: unknown } }).root?.children)

export function resolveDiffNotes(
  state: unknown,
  side: 'original' | 'proposed',
): unknown {
  if (!isLexicalState(state)) return state
  const children = state.root.children.flatMap((block) => {
    if (!isDiffNote(block)) return [block]
    const picked = side === 'original' ? block.originalNode : block.proposedNode
    return picked ? [picked] : []
  })
  return withChildren(state, children)
}
