import type { AiAgentSseEvent } from '@mx-space/api-client'

import { API_URL } from '~/constants/env'

export type AdminAiAgentSseEvent = AiAgentSseEvent

export interface AdminAgentChatRequest {
  messages: Record<string, unknown>[]
  model: string
  signal?: AbortSignal
  tools?: Array<{
    description: string
    name: string
    parameters: Record<string, unknown>
  }>
}

export type AdminAgentTransport = (
  request: AdminAgentChatRequest,
) => AsyncIterable<AiAgentSseEvent>

export function createAdminAgentTransport(
  providerId: string,
): AdminAgentTransport {
  return async function* admin(request) {
    const response = await fetch(`${API_URL}/ai/agent/chat`, {
      body: JSON.stringify({
        messages: request.messages,
        model: request.model,
        providerId,
        tools: request.tools,
      }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-skip-translation': '1',
      },
      method: 'POST',
      signal: request.signal,
    })

    if (!response.ok || !response.body) {
      const text = await safeReadResponseText(response)
      throw new Error(text || `Agent chat failed: HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let separatorIndex: number
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, separatorIndex)
          buffer = buffer.slice(separatorIndex + 2)
          const event = parseSseFrame(frame)
          if (event) yield event
        }
      }

      const tail = buffer.trim()
      if (tail.length > 0) {
        const event = parseSseFrame(tail)
        if (event) yield event
      }
    } finally {
      reader.releaseLock()
    }
  }
}

function parseSseFrame(frame: string): AiAgentSseEvent | null {
  let payload = ''
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line.length === 0) continue
    if (line.startsWith(':')) continue
    if (line.startsWith('data:')) {
      payload += line.slice(5).replace(/^ /, '')
    }
  }

  if (payload.length === 0) return null

  try {
    return JSON.parse(payload) as AiAgentSseEvent
  } catch {
    return null
  }
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return ''
  }
}

export function mapAgentProviderType(
  type: string,
): 'claude' | 'openai-compatible' {
  if (type === 'anthropic' || type === 'claude') return 'claude'
  return 'openai-compatible'
}
