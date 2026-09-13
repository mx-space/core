import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

type Block = SerializedLexicalNode & {
  $?: { blockId?: string }
  originalNode?: Block | null
  proposedNode?: Block | null
}

export type DiffNoteOp = 'insert' | 'replace' | 'delete'

export interface MergeResult {
  children: Block[]
  conflicts: number
}

const BATCH_ID = 'mxs-author'

const stripState = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(stripState)
  if (typeof node !== 'object' || node === null) return node
  const { $: _state, ...rest } = node as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, stripState(v)]),
  )
}

// Hydration mints block ids and normalizes defaults, so identity is content
// with `$` state removed; ids only disambiguate when both sides carry one.
const refOf = (block: Block): string => JSON.stringify(stripState(block))

const same = (a: Block, b: Block) => refOf(a) === refOf(b)

const isDiffNote = (block: Block) => block.type === 'agent-diff'

export const resolveToProposed = (blocks: Block[]): Block[] =>
  blocks.flatMap((block) =>
    isDiffNote(block)
      ? block.proposedNode
        ? [block.proposedNode]
        : []
      : [block],
  )

let entrySeq = 0
const note = (
  opType: DiffNoteOp,
  originalNode: Block | null,
  proposedNode: Block | null,
): Block =>
  ({
    type: 'agent-diff',
    version: 2,
    batchId: BATCH_ID,
    diffEntryId: `${BATCH_ID}-live-${entrySeq++}`,
    opType,
    originalNode,
    proposedNode,
  }) as Block

type Op =
  | { kind: 'eq'; base: Block; remote: Block }
  | { kind: 'replace'; base: Block; remote: Block }
  | { kind: 'delete'; base: Block }
  | { kind: 'insert'; remote: Block }

const lcs = (a: string[], b: string[]) => {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }
  const out: Array<'eq' | 'del' | 'add'> = []
  let i = a.length
  let j = b.length
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push('eq')
      i--
      j--
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push('del')
      i--
    } else {
      out.push('add')
      j--
    }
  }
  while (i-- > 0) out.push('del')
  while (j-- > 0) out.push('add')
  return out.reverse()
}

const pairRun = (dels: Block[], adds: Block[]): Op[] => {
  const ops: Op[] = []
  const unpairedAdds = [...adds]
  const unpairedDels: Block[] = []
  for (const base of dels) {
    const id = base.$?.blockId
    const idx = id ? unpairedAdds.findIndex((b) => b.$?.blockId === id) : -1
    if (idx >= 0)
      ops.push({
        kind: 'replace',
        base,
        remote: unpairedAdds.splice(idx, 1)[0]!,
      })
    else unpairedDels.push(base)
  }
  const paired = Math.min(unpairedDels.length, unpairedAdds.length)
  for (let k = 0; k < paired; k++) {
    ops.push({
      kind: 'replace',
      base: unpairedDels[k]!,
      remote: unpairedAdds[k]!,
    })
  }
  for (const base of unpairedDels.slice(paired))
    ops.push({ kind: 'delete', base })
  for (const remote of unpairedAdds.slice(paired))
    ops.push({ kind: 'insert', remote })
  return ops
}

export const diffBlocks = (base: Block[], remote: Block[]): Op[] => {
  const steps = lcs(base.map(refOf), remote.map(refOf))
  const ops: Op[] = []
  let bi = 0
  let ri = 0
  let i = 0
  while (i < steps.length) {
    if (steps[i] === 'eq') {
      const b = base[bi++]!
      const r = remote[ri++]!
      ops.push(
        same(b, r)
          ? { kind: 'eq', base: b, remote: r }
          : { kind: 'replace', base: b, remote: r },
      )
      i++
      continue
    }
    const dels: Block[] = []
    const adds: Block[] = []
    while (i < steps.length && steps[i] !== 'eq') {
      if (steps[i] === 'del') dels.push(base[bi++]!)
      else adds.push(remote[ri++]!)
      i++
    }
    ops.push(...pairRun(dels, adds))
  }
  return ops
}

export function mergeRevision(
  base: Block[],
  localRaw: Block[],
  remote: Block[],
): MergeResult {
  const local = resolveToProposed(localRaw)
  const spine: Array<{ ref: string; block: Block }> = local.map((block) => ({
    ref: refOf(block),
    block,
  }))
  const indexOf = (ref: string) => spine.findIndex((e) => e.ref === ref)
  const indexOfBase = (block: Block) => {
    const id = block.$?.blockId
    const byId =
      id === undefined ? -1 : spine.findIndex((e) => e.block.$?.blockId === id)
    return byId >= 0 ? byId : indexOf(refOf(block))
  }
  let conflicts = 0
  let anchor: string | null = null

  const placeAfterAnchor = (entry: { ref: string; block: Block }) => {
    const at = anchor === null ? -1 : indexOf(anchor)
    spine.splice(at + 1, 0, entry)
    anchor = entry.ref
  }

  for (const op of diffBlocks(base, remote)) {
    if (op.kind === 'eq') {
      const at = indexOfBase(op.base)
      if (at >= 0) anchor = spine[at]!.ref
      continue
    }
    if (op.kind === 'insert') {
      placeAfterAnchor({
        ref: refOf(op.remote),
        block: note('insert', null, op.remote),
      })
      continue
    }
    const at = indexOfBase(op.base)
    if (at < 0) {
      if (op.kind === 'replace') {
        conflicts++
        placeAfterAnchor({
          ref: refOf(op.remote),
          block: note('insert', null, op.remote),
        })
      }
      continue
    }
    const { ref, block: current } = spine[at]!
    const edited = !same(current, op.base)
    if (edited) conflicts++
    const original = edited ? current : op.base
    spine[at] = {
      ref,
      block:
        op.kind === 'replace'
          ? note('replace', original, op.remote)
          : note('delete', original, null),
    }
    anchor = ref
  }

  return { children: spine.map((e) => e.block), conflicts }
}

export const blocksOf = (state: SerializedEditorState): Block[] =>
  state.root.children as Block[]
