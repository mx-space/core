import type { AgentOperation, ReviewBatch } from '@haklex/rich-agent-core'
import { blockIdState } from '@haklex/rich-editor'
import type { LexicalEditor, LexicalNode } from 'lexical'
import { $getRoot, $getState, $parseSerializedNode, $setState } from 'lexical'

function $findBlockByBlockId(blockId: string): LexicalNode | null {
  const root = $getRoot()
  for (const child of root.getChildren()) {
    if ($getState(child, blockIdState) === blockId) {
      return child
    }
  }
  return null
}

function $buildBlockIdIndex(): Map<string, LexicalNode> {
  const index = new Map<string, LexicalNode>()
  for (const child of $getRoot().getChildren()) {
    const id = $getState(child, blockIdState)
    if (id) index.set(id, child)
  }
  return index
}

// Tool calls emit serialized nodes whose `$.blockId` was guessed by the LLM.
// Strip it and let BlockIdPlugin re-assign to avoid State key collision.
function stripBlockIdFromSerialized<
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
    next.children = next.children.map((c) =>
      stripBlockIdFromSerialized(c as any),
    )
  }
  return next
}

export type AgentOperationApplyStatus = 'conflict' | 'error' | 'success'

export interface AgentOperationApplyResult {
  message?: string
  status: AgentOperationApplyStatus
}

function applyOperation(op: AgentOperation): AgentOperationApplyResult {
  try {
    if (op.op === 'insert') {
      if (!op.node?.type) {
        return {
          message: 'Insert operation missing node type',
          status: 'error',
        }
      }

      const newNode = $parseSerializedNode(stripBlockIdFromSerialized(op.node))
      if (op.position.type === 'root') {
        const root = $getRoot()
        const idx = op.position.index ?? root.getChildrenSize()
        const children = root.getChildren()
        if (idx >= children.length) root.append(newNode)
        else children[idx].insertBefore(newNode)
      } else {
        const target = $findBlockByBlockId(op.position.blockId)
        if (!target) {
          return {
            message: `Target block not found: ${op.position.blockId}`,
            status: 'conflict',
          }
        }
        if (op.position.type === 'after') target.insertAfter(newNode)
        else target.insertBefore(newNode)
      }

      return { status: 'success' }
    }

    if (op.op === 'replace') {
      if (!op.node?.type) {
        return {
          message: 'Replace operation missing node type',
          status: 'error',
        }
      }

      const target = $findBlockByBlockId(op.blockId)
      if (!target) {
        return {
          message: `Target block not found: ${op.blockId}`,
          status: 'conflict',
        }
      }
      const replacement = $parseSerializedNode(
        stripBlockIdFromSerialized(op.node),
      )
      target.replace(replacement)
      $setState(replacement, blockIdState, op.blockId)

      return { status: 'success' }
    }

    if (op.op === 'delete') {
      const target = $findBlockByBlockId(op.blockId)
      if (!target) {
        return {
          message: `Target block not found: ${op.blockId}`,
          status: 'conflict',
        }
      }
      target.remove()

      return { status: 'success' }
    }

    return {
      message: `Unknown operation type: ${(op as any).op}`,
      status: 'error',
    }
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : String(error),
      status: 'error',
    }
  }
}

export function applyAgentOperation(
  editor: LexicalEditor,
  op: AgentOperation,
): AgentOperationApplyResult {
  let result: AgentOperationApplyResult = {
    message: 'Not executed',
    status: 'error',
  }

  editor.update(
    () => {
      result = applyOperation(op)
    },
    { discrete: true },
  )

  return result
}

export interface AgentBatchApplySummary {
  conflict: number
  error: number
  success: number
  total: number
}

export function applyAgentReviewBatch(
  editor: LexicalEditor,
  batch: ReviewBatch,
): AgentBatchApplySummary {
  const summary: AgentBatchApplySummary = {
    conflict: 0,
    error: 0,
    success: 0,
    total: batch.entries.length,
  }

  editor.update(
    () => {
      const root = $getRoot()
      // blockId → live LexicalNode. Updated as ops mutate the tree so a
      // replace's new node still answers to the old blockId for subsequent
      // inserts that anchor on it.
      const blockIndex = $buildBlockIdIndex()
      const lastInserted = new Map<string, LexicalNode>()

      const resolveAnchor = (blockId: string): LexicalNode | null => {
        const cached = blockIndex.get(blockId)
        if (cached?.isAttached()) return cached
        const found = $findBlockByBlockId(blockId)
        if (found) blockIndex.set(blockId, found)
        return found
      }

      for (const entry of batch.entries) {
        const { op } = entry
        try {
          if (op.op === 'insert') {
            if (!op.node?.type) {
              summary.error += 1
              continue
            }
            const newNode = $parseSerializedNode(
              stripBlockIdFromSerialized(op.node),
            )
            if (op.position.type === 'root') {
              const idx = op.position.index ?? root.getChildrenSize()
              const children = root.getChildren()
              if (idx >= children.length) root.append(newNode)
              else children[idx].insertBefore(newNode)
              summary.success += 1
            } else {
              const anchorKey = `${op.position.type}:${op.position.blockId}`
              const prev = lastInserted.get(anchorKey)
              if (prev?.isAttached()) {
                prev.insertAfter(newNode)
              } else {
                const target = resolveAnchor(op.position.blockId)
                if (!target) {
                  summary.conflict += 1
                  continue
                }
                if (op.position.type === 'after') target.insertAfter(newNode)
                else target.insertBefore(newNode)
              }
              lastInserted.set(anchorKey, newNode)
              summary.success += 1
            }
          } else if (op.op === 'replace') {
            if (!op.node?.type) {
              summary.error += 1
              continue
            }
            const target = resolveAnchor(op.blockId)
            if (!target) {
              summary.conflict += 1
              continue
            }
            const replacement = $parseSerializedNode(
              stripBlockIdFromSerialized(op.node),
            )
            target.replace(replacement)
            // Re-stamp the original blockId so subsequent ops anchored on it
            // (e.g. insert after blockId X chains) can still resolve.
            $setState(replacement, blockIdState, op.blockId)
            blockIndex.set(op.blockId, replacement)
            summary.success += 1
          } else if (op.op === 'delete') {
            const target = resolveAnchor(op.blockId)
            if (!target) {
              summary.conflict += 1
              continue
            }
            target.remove()
            blockIndex.delete(op.blockId)
            summary.success += 1
          }
        } catch {
          summary.error += 1
        }
      }
    },
    { discrete: true },
  )

  return summary
}
