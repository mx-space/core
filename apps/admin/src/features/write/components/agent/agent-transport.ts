import type { TransportAdapter } from '@haklex/rich-agent-core'

import { API_URL } from '~/constants/env'

export function createAdminAgentTransport(
  providerId: string,
): TransportAdapter {
  return async (messages, tools, model, signal) => {
    const response = await fetch(`${API_URL}/ai/agent/chat`, {
      body: JSON.stringify({ messages, model, providerId, tools }),
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-skip-translation': '1',
      },
      method: 'POST',
      signal,
    })

    if (!response.ok || !response.body) return response

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const first = await reader.read()

    if (first.done) {
      reader.releaseLock()
      return new Response(new ReadableStream(), {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      })
    }

    const firstText = decoder.decode(first.value, { stream: true })
    if (/(^|\n)event:\s*error/.test(firstText)) {
      let buffer = firstText
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
      }
      reader.releaseLock()
      throw new Error(extractSseErrorMessage(buffer))
    }

    const stream = new ReadableStream<Uint8Array>({
      cancel(reason) {
        reader.cancel(reason).catch(() => {})
      },
      async pull(controller) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }

          const text = decoder.decode(value, { stream: true })
          if (/(^|\n)event:\s*error/.test(text)) {
            let buffer = text
            while (true) {
              const { done: d, value: v } = await reader.read()
              if (d) break
              buffer += decoder.decode(v, { stream: true })
            }
            controller.error(new Error(extractSseErrorMessage(buffer)))
            return
          }

          controller.enqueue(value)
        } catch (error) {
          controller.error(error)
        }
      },
      start(controller) {
        controller.enqueue(first.value)
      },
    })

    return new Response(stream, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    })
  }
}

function extractSseErrorMessage(buffer: string): string {
  const match = buffer.match(/data:\s*(\{[\s\S]*?\})\s*(?:\n|$)/)
  if (match) {
    try {
      const parsed = JSON.parse(match[1]) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      // Fall through to a bounded raw message.
    }
  }
  return buffer.slice(0, 500) || 'Unknown SSE error'
}

export function mapAgentProviderType(
  type: string,
): 'claude' | 'openai-compatible' {
  if (type === 'anthropic' || type === 'claude') return 'claude'
  return 'openai-compatible'
}
