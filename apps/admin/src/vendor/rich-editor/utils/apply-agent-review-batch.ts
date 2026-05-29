import { $getRoot, $getState, $parseSerializedNode } from 'lexical'
import type { AgentOperation, ReviewBatch } from '@haklex/rich-agent-core'
import type { LexicalEditor, LexicalNode } from 'lexical'

import { blockIdState } from '@haklex/rich-editor'

function $findBlockByBlockId(blockId: string): LexicalNode | null {
  const root = $getRoot()
  for (const child of root.getChildren()) {
    if ($getState(child, blockIdState) === blockId) {
      return child
    }
  }
  return null
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
      target.replace($parseSerializedNode(stripBlockIdFromSerialized(op.node)))

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

export function applyAgentReviewBatch(
  editor: LexicalEditor,
  batch: ReviewBatch,
): void {
  editor.update(() => {
    const root = $getRoot()
    const lastInserted = new Map<string, LexicalNode>()
    for (const entry of batch.entries) {
      const { op } = entry
      if (op.op === 'insert') {
        if (!op.node?.type) continue
        const newNode = $parseSerializedNode(
          stripBlockIdFromSerialized(op.node),
        )
        if (op.position.type === 'root') {
          const idx = op.position.index ?? root.getChildrenSize()
          const children = root.getChildren()
          if (idx >= children.length) root.append(newNode)
          else children[idx].insertBefore(newNode)
        } else {
          const anchorKey = `${op.position.type}:${op.position.blockId}`
          const prev = lastInserted.get(anchorKey)
          if (prev) {
            prev.insertAfter(newNode)
          } else {
            const target = $findBlockByBlockId(op.position.blockId)
            if (!target) continue
            if (op.position.type === 'after') target.insertAfter(newNode)
            else target.insertBefore(newNode)
          }
          lastInserted.set(anchorKey, newNode)
        }
      } else if (op.op === 'replace') {
        if (!op.node?.type) continue
        const target = $findBlockByBlockId(op.blockId)
        if (!target) continue
        target.replace(
          $parseSerializedNode(stripBlockIdFromSerialized(op.node)),
        )
      } else if (op.op === 'delete') {
        const target = $findBlockByBlockId(op.blockId)
        if (!target) continue
        target.remove()
      }
    }
  })
}
