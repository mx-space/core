import type {
  AgentStoreStatus,
  ChatBubble,
  ReviewState,
} from '@haklex/rich-agent-core'
import { useEffect, useRef } from 'react'

import type { WriteAgentController } from '~/features/write/components/agent'

import type { CrdtDraftController } from './use-crdt-draft'

const SUMMARY_LIMIT = 60

export function agentTurnMessage(state: {
  bubbles: ChatBubble[]
  status: AgentStoreStatus
}): string | null {
  if (state.status === 'idle' || state.status === 'done') return null
  const request = state.bubbles.findLast((bubble) => bubble.type === 'user')
  const summary =
    request?.type === 'user'
      ? request.content.replaceAll(/\s+/g, ' ').trim().slice(0, SUMMARY_LIMIT)
      : ''
  return `agent:${summary}`
}

export function pendingReviewBatchIds(review: ReviewState | null): string[] {
  return (review?.batches ?? [])
    .filter((batch) => batch.status === 'pending')
    .map((batch) => batch.id)
}

// A bound editor persists every node, so agent edits are accepted as they land
// and labelled as one agent step instead of waiting in a review.
export function useCrdtAgentTurns(
  agent: WriteAgentController,
  crdt: CrdtDraftController | undefined,
) {
  const active = Boolean(crdt?.active)
  const setCommitMessage = crdt?.setCommitMessage
  const { store } = agent
  const acceptBatchRef = useRef(agent.acceptBatch)
  acceptBatchRef.current = agent.acceptBatch

  useEffect(() => {
    if (!active || !setCommitMessage) return
    const sync = () => {
      const state = store.getState()
      setCommitMessage(agentTurnMessage(state))
      for (const batchId of pendingReviewBatchIds(state.reviewState)) {
        acceptBatchRef.current(batchId)
      }
    }
    sync()
    const unsubscribe = store.subscribe(sync)
    return () => {
      unsubscribe()
      setCommitMessage(null)
    }
  }, [active, setCommitMessage, store])
}
