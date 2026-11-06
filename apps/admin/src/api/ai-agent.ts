import type { AgentHistoryBubble } from '@mx-space/ai'

import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

export interface AgentConversation {
  createdAt: string
  id: string
  model: string
  providerId: string
  sessionId: string
  title: string | null
  updatedAt: string | null
}

export interface AgentReviewAnchor {
  batchId: string
  toolCallId: string
}

export interface AgentConversationDetail extends AgentConversation {
  bubbles: AgentHistoryBubble[]
  reviewState: Record<string, unknown> | null
  anchors: AgentReviewAnchor[]
}

export function getAgentConversations(sessionId: string) {
  return getJson<AgentConversation[]>('/ai/agent/conversations', {
    sessionId,
  })
}

export function getAgentConversation(id: string) {
  return getJson<AgentConversationDetail>(`/ai/agent/conversations/${id}`)
}

export function updateAgentConversation(
  id: string,
  data: { sessionId: string },
) {
  return patchJson<AgentConversation, typeof data>(
    `/ai/agent/conversations/${id}`,
    data,
  )
}

export function saveAgentConversationReviewState(
  id: string,
  data: {
    reviewState: Record<string, unknown> | null
    anchors: AgentReviewAnchor[]
  },
) {
  return putJson<void, typeof data>(
    `/ai/agent/conversations/${id}/review-state`,
    data,
  )
}

export function deleteAgentConversation(id: string) {
  return deleteJson<void>(`/ai/agent/conversations/${id}`)
}

export function generateAgentConversationTitle(id: string) {
  return postJson<AgentConversation, Record<string, never>>(
    `/ai/agent/conversations/${id}/title`,
    {},
  )
}
