import type {
  AgentOperation,
  AgentStore,
  AgentStoreSlice,
  DiffState,
  ReviewBatch,
  ReviewState,
} from '@haklex/rich-agent-core'

import { createAgentStore } from '@haklex/rich-agent-core'

export function createManagedAgentStore(): AgentStore {
  const store = createAgentStore()
  patchReviewStateActions(store)
  return store
}

function stripBlockIdFromSerializedNode<
  T extends { $?: Record<string, unknown>; children?: unknown[] },
>(node: T): T {
  if (!node || typeof node !== 'object') return node

  const next = { ...node } as T & {
    $?: Record<string, unknown>
    children?: unknown[]
  }

  if (next.$ && typeof next.$ === 'object') {
    const rest = { ...next.$ }
    delete rest.blockId
    if (Object.keys(rest).length === 0) delete next.$
    else next.$ = rest
  }

  if (Array.isArray(next.children)) {
    next.children = next.children.map((child) =>
      stripBlockIdFromSerializedNode(child as any),
    )
  }

  return next
}

function sanitizeReviewOperation(op: AgentOperation): AgentOperation {
  if (op.op === 'insert' || op.op === 'replace') {
    if (!op.node) return op
    return {
      ...op,
      node: stripBlockIdFromSerializedNode(op.node as any),
    }
  }

  return op
}

function sanitizeReviewBatch(batch: ReviewBatch): ReviewBatch {
  return {
    ...batch,
    entries: batch.entries.map((entry) => ({
      ...entry,
      op: sanitizeReviewOperation(entry.op),
    })),
  }
}

function sanitizeDiffState(diffState: DiffState | null): DiffState | null {
  if (!diffState) return diffState

  const entries = diffState.entries.map((entry) => ({
    ...entry,
    op: sanitizeReviewOperation(entry.op),
  }))

  return {
    ...diffState,
    entries,
    getByBlockId(blockId: string) {
      return entries.find((entry) => {
        if (entry.op.op === 'replace' || entry.op.op === 'delete') {
          return entry.op.blockId === blockId
        }
        if (entry.op.op === 'insert' && entry.op.position.type !== 'root') {
          return entry.op.position.blockId === blockId
        }
        return false
      })
    },
    getPending() {
      return entries.filter((entry) => entry.status === 'pending')
    },
  }
}

function sanitizeReviewState(
  reviewState: ReviewState | null,
): ReviewState | null {
  if (!reviewState) return reviewState

  return {
    ...reviewState,
    batches: reviewState.batches.map(sanitizeReviewBatch),
  }
}

function sanitizeStoreSlice(
  slice: AgentStoreSlice | Partial<AgentStoreSlice>,
): AgentStoreSlice | Partial<AgentStoreSlice> {
  const next = { ...slice }

  if ('diffState' in next) {
    next.diffState = sanitizeDiffState(next.diffState ?? null)
  }

  if ('reviewState' in next) {
    next.reviewState = sanitizeReviewState(next.reviewState ?? null)
  }

  return next
}

function patchReviewStateActions(store: AgentStore) {
  const state = store.getState()
  const setState = store.setState.bind(store)
  const addReviewBatch = state.addReviewBatch
  const setDiffState = state.setDiffState
  const setReviewState = state.setReviewState

  store.setState = ((partial, replace) => {
    if (typeof partial === 'function') {
      return setState(
        ((current) =>
          sanitizeStoreSlice(partial(current) as AgentStoreSlice)) as any,
        replace as any,
      )
    }

    return setState(
      sanitizeStoreSlice(partial as AgentStoreSlice),
      replace as any,
    )
  }) as typeof store.setState

  state.setDiffState = (diffState: DiffState | null) =>
    setDiffState(sanitizeDiffState(diffState))
  state.addReviewBatch = (batch: ReviewBatch) =>
    addReviewBatch(sanitizeReviewBatch(batch))
  state.setReviewState = (reviewState: ReviewState | null) =>
    setReviewState(sanitizeReviewState(reviewState))
}
