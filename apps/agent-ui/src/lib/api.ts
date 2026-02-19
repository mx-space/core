import type {
  AIAgentRuntimeConfig,
  AIAgentSession,
  GetSessionResponse,
  PaginatedMessages,
} from '@/types/agent'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const PREFIX = import.meta.env.PROD ? '/api/v2' : ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${PREFIX}${path}`
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
    },
    ...init,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body || res.statusText)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text)
}

export const api = {
  getConfig() {
    return request<AIAgentRuntimeConfig>('/ai/agent/config')
  },

  putConfig(config: {
    providers: Array<{
      id: string
      name: string
      type: string
      apiKey: string
      endpoint?: string
      defaultModel: string
      enabled: boolean
    }>
    agentModel?: { providerId?: string; model?: string }
    enabledTools?: string[]
  }) {
    return request<AIAgentRuntimeConfig>('/ai/agent/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  },

  createSession(title?: string) {
    return request<AIAgentSession>('/ai/agent/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
  },

  getSessions() {
    return request<AIAgentSession[] | { data: AIAgentSession[] }>(
      '/ai/agent/sessions',
    )
  },

  getSession(id: string) {
    return request<GetSessionResponse>(`/ai/agent/sessions/${id}`)
  },

  getMessages(sessionId: string, page = 1, size = 50) {
    return request<PaginatedMessages>(
      `/ai/agent/sessions/${sessionId}/messages?page=${page}&size=${size}`,
    )
  },

  sendMessage(sessionId: string, content: string) {
    return request<void>(`/ai/agent/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },

  confirmAction(actionId: string) {
    return request<{ success: boolean }>(
      `/ai/agent/actions/${actionId}/confirm`,
      {
        method: 'POST',
      },
    )
  },

  rejectAction(actionId: string) {
    return request<{ success: boolean }>(
      `/ai/agent/actions/${actionId}/reject`,
      {
        method: 'POST',
      },
    )
  },
}
