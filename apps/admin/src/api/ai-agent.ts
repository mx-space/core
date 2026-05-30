import { deleteJson, getJson, patchJson, postJson, putJson } from './http'

export interface AgentConversation {
  createdAt: string
  id: string
  messages?: Record<string, unknown>[]
  model: string | null
  providerId: string | null
  sessionId: string
  updatedAt: string
}

export function createAgentConversation(data: {
  messages?: Record<string, unknown>[]
  model?: string | null
  providerId?: string | null
  sessionId: string
}) {
  return postJson<AgentConversation, typeof data>(
    '/ai/agent/conversations',
    data,
  )
}

export function getAgentConversations(sessionId: string) {
  return getJson<AgentConversation[]>('/ai/agent/conversations', {
    sessionId,
  })
}

export function getAgentConversation(id: string) {
  return getJson<AgentConversation>(`/ai/agent/conversations/${id}`)
}

export function appendAgentConversationMessages(
  id: string,
  messages: Record<string, unknown>[],
) {
  return patchJson<AgentConversation, { messages: Record<string, unknown>[] }>(
    `/ai/agent/conversations/${id}/messages`,
    { messages },
  )
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
    model?: string | null
    providerId?: string | null
    sessionId?: string
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
