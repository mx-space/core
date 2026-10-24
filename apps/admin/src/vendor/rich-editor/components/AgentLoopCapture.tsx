import type {
  AgentOperation,
  AgentStore,
  AgentToolConfig,
  ChatMessage,
} from '@haklex/rich-agent-core'
import { createReviewBatch } from '@haklex/rich-agent-core'
import { projectAgentDiffNodesToFactualState } from '@haklex/rich-ext-ai-agent'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { LexicalEditor, SerializedEditorState } from 'lexical'
import type { RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'

import type { AgentLoopHandle, AgentRuntime } from '../types'
import { supersedePendingBatches } from '../utils/document-bash'

interface AgentLoopCaptureInnerProps {
  agentRuntime: AgentRuntime
  editorRef: RefObject<LexicalEditor | null>
  onAgentLoopReady: (loop: AgentLoopHandle | null) => void
  store: AgentStore
  systemMessages?: ChatMessage[]
  tools?: AgentToolConfig[]
}

function AgentLoopCaptureInner({
  agentRuntime,
  editorRef,
  onAgentLoopReady,
  store,
  systemMessages,
  tools,
}: AgentLoopCaptureInnerProps) {
  const [editor] = useLexicalComposerContext()
  const abortRef = useRef<AbortController | null>(null)
  const latest = useRef({ agentRuntime, systemMessages, tools })
  latest.current = { agentRuntime, systemMessages, tools }

  const loop = useMemo<AgentLoopHandle>(
    () => ({
      abort: () => abortRef.current?.abort(),
      steer: (userInput) => latest.current.agentRuntime.steer(userInput),
      run: async (userInput) => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        const base = projectAgentDiffNodesToFactualState(
          editor.getEditorState().toJSON() as SerializedEditorState,
        )
        const pinned = store.getState().pinnedSelection
        let activeBatchId: string | null = null

        // The workspace diffs against the accepted document, so each emission
        // carries every proposal still under review; older unsettled batches
        // would show the same edits twice.
        const dropBatches = (ids: string[]) => {
          const { reviewState } = store.getState()
          if (!ids.length || !reviewState) return
          store.getState().setReviewState({
            ...reviewState,
            batches: reviewState.batches.filter(
              (batch) => !ids.includes(batch.id),
            ),
          })
          store.setState({
            bubbles: store
              .getState()
              .bubbles.filter(
                (bubble) =>
                  bubble.type !== 'diff_review' ||
                  !ids.includes(bubble.batchId),
              ),
          })
        }

        const onOperationsChanged = (operations: AgentOperation[]) => {
          const { reviewState } = store.getState()
          if (reviewState) {
            dropBatches(
              supersedePendingBatches(reviewState, activeBatchId).removedIds,
            )
          }
          if (operations.length === 0) {
            if (activeBatchId) dropBatches([activeBatchId])
            activeBatchId = null
            return
          }
          const state = store.getState()
          const revision = state.reviewState?.documentRevision ?? 0
          const batch = createReviewBatch(operations, base, revision)
          if (activeBatchId && state.reviewState) {
            const batchId = activeBatchId
            state.setReviewState({
              ...state.reviewState,
              batches: state.reviewState.batches.map((existing) =>
                existing.id === batchId ? { ...batch, id: batchId } : existing,
              ),
            })
            return
          }
          activeBatchId = batch.id
          state.addReviewBatch(batch)
          state.addBubble({ batchId: batch.id, type: 'diff_review' })
        }

        const { agentRuntime, systemMessages, tools } = latest.current
        await agentRuntime.run({
          onOperationsChanged,
          signal: controller.signal,
          systemMessages: (systemMessages ?? []).flatMap((message) =>
            message.role === 'system' ? [message.content] : [],
          ),
          tools: tools ?? [],
          userInput,
        })
        if (pinned) store.getState().clearPinnedSelection()
      },
    }),
    [editor, store],
  )

  useEffect(() => {
    onAgentLoopReady(loop)
    return () => onAgentLoopReady(null)
  }, [loop, onAgentLoopReady])

  useEffect(() => {
    editorRef.current = editor
  }, [editor, editorRef])

  useEffect(() => () => abortRef.current?.abort(), [])

  return null
}

export interface AgentLoopCaptureProps {
  agentRuntime: AgentRuntime | null
  editorRef: RefObject<LexicalEditor | null>
  onAgentLoopReady: (loop: AgentLoopHandle | null) => void
  store: AgentStore
  systemMessages?: ChatMessage[]
  tools?: AgentToolConfig[]
}

export function AgentLoopCapture({
  agentRuntime,
  ...props
}: AgentLoopCaptureProps) {
  const { onAgentLoopReady } = props
  useEffect(() => {
    if (!agentRuntime) onAgentLoopReady(null)
  }, [agentRuntime, onAgentLoopReady])

  if (!agentRuntime) return null
  return <AgentLoopCaptureInner agentRuntime={agentRuntime} {...props} />
}
