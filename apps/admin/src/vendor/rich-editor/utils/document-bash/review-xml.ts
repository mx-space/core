import type { AgentOperation, ReviewBatch } from '@haklex/rich-agent-core'
import { applyOpsToSnapshot } from '@haklex/rich-agent-core'
import { serializeMxLexicalNodesToLitexml } from '@mx-space/editor'
import type { SerializedEditorState } from 'lexical'

const SETTLED_BATCH = new Set<ReviewBatch['status']>(['accepted', 'rejected'])

export function buildReviewXml(
  reviewState: { batches: ReviewBatch[] } | null | undefined,
): string {
  const proposals = pendingReviewOperations(reviewState).map((op) =>
    describeOperation(op),
  )
  return proposals.length
    ? ['<review>', ...proposals, '</review>', ''].join('\n')
    : ''
}

function describeOperation(op: AgentOperation) {
  switch (op.op) {
    case 'insert': {
      const position =
        op.position.type === 'root'
          ? `at="${op.position.index ?? 'end'}"`
          : `${op.position.type}="${op.position.blockId}"`
      return wrap(`insert ${position}`, 'insert', op.node)
    }
    case 'replace': {
      return wrap(`replace block="${op.blockId}"`, 'replace', op.node)
    }
    case 'delete': {
      return `<delete block="${op.blockId}"/>`
    }
  }
}

function wrap(
  open: string,
  tag: string,
  node: Parameters<typeof serializeMxLexicalNodesToLitexml>[0][number],
) {
  const body = serializeMxLexicalNodesToLitexml([node], { compact: false })
  return `<${open}>\n${body.trimEnd()}\n</${tag}>`
}

export function pendingReviewOperations(
  reviewState: { batches: ReviewBatch[] } | null | undefined,
): AgentOperation[] {
  return (reviewState?.batches ?? [])
    .filter((batch) => !SETTLED_BATCH.has(batch.status))
    .flatMap((batch) => batch.entries)
    .filter((entry) => entry.status === 'pending')
    .map((entry) => entry.op)
}

export function buildProposedState(
  accepted: SerializedEditorState,
  reviewState: { batches: ReviewBatch[] } | null | undefined,
): SerializedEditorState {
  const operations = pendingReviewOperations(reviewState)
  return operations.length
    ? (applyOpsToSnapshot(accepted, operations) as SerializedEditorState)
    : accepted
}

export function supersedePendingBatches<
  State extends { batches: ReviewBatch[] },
>(state: State, keepBatchId: string | null) {
  const removedIds = state.batches
    .filter((batch) => !SETTLED_BATCH.has(batch.status))
    .map((batch) => batch.id)
    .filter((id) => id !== keepBatchId)
  return {
    removedIds,
    state: {
      ...state,
      batches: state.batches.filter((batch) => !removedIds.includes(batch.id)),
    },
  }
}
