import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

export interface AgentConversation {
  createdAt: string
  diffState?: Record<string, unknown>
  id: string
  messageCount: number
  messages?: Record<string, unknown>[]
  model: string
  providerId: string
  refId: string
  refType: string
  reviewState?: Record<string, unknown>
  title?: string
  updatedAt: string
}

export function createAgentConversation(data: {
  messages?: Record<string, unknown>[]
  model: string
  providerId: string
  refId: string
  refType: 'note' | 'page' | 'post'
  title?: string
}) {
  return postJson<AgentConversation, typeof data>(
    '/ai/agent/conversations',
    data,
  )
}

export function getAgentConversations(
  refId: string,
  refType: 'note' | 'page' | 'post',
) {
  return getJson<AgentConversation[]>('/ai/agent/conversations', {
    refId,
    refType,
  })
}

export function getAgentConversation(id: string) {
  return getJson<AgentConversation>(`/ai/agent/conversations/${id}`)
}

export function replaceAgentConversationMessages(
  id: string,
  messages: Record<string, unknown>[],
) {
  return putJson<AgentConversation, { messages: Record<string, unknown>[] }>(
    `/ai/agent/conversations/${id}/messages`,
    { messages },
  )
}

export function updateAgentConversation(
  id: string,
  data: {
    diffState?: Record<string, unknown> | null
    reviewState?: Record<string, unknown> | null
    title?: string
  },
) {
  return patchJson<AgentConversation, typeof data>(
    `/ai/agent/conversations/${id}`,
    data,
  )
}

export function deleteAgentConversation(id: string) {
  return deleteJson<void>(`/ai/agent/conversations/${id}`)
}
