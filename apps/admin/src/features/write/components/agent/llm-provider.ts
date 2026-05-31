import type {
  ChatMessage,
  LLMChunk,
  LLMProvider,
  ToolSchema,
} from '@haklex/rich-agent-core'

import { createAdminAgentTransport } from './agent-transport'

export interface AbortSignalRef {
  current: AbortSignal | null
}

interface CreateProviderOptions {
  providerId: string
  model: string
  signalRef: AbortSignalRef
}

/**
 * Build an `LLMProvider` that drives haklex's agent loop through mx-core's
 * JSON-framed `AiAgentSseEvent` SSE endpoint. We bypass haklex's
 * `createProvider`/`TransportAdapter` (which expects raw provider SSE bytes)
 * and translate `AiAgentSseEvent` → `LLMChunk` directly here.
 *
 * `signalRef` is consulted lazily on each `chat()` call so the admin can
 * abort the in-flight fetch independently of haklex's internal executor
 * signal (haklex `LLMProvider.chat` has no signal in its protocol).
 */
export function createSseLlmProvider({
  providerId,
  model,
  signalRef,
}: CreateProviderOptions): LLMProvider {
  const transport = createAdminAgentTransport(providerId)

  return {
    async *chat(messages: ChatMessage[], tools?: ToolSchema[]) {
      const stream = transport({
        messages: messages as unknown as Record<string, unknown>[],
        model,
        signal: signalRef.current ?? undefined,
        tools,
      })

      for await (const ev of stream) {
        switch (ev.type) {
          case 'text_delta': {
            yield { type: 'text', text: ev.delta } satisfies LLMChunk
            break
          }
          case 'thinking_delta': {
            yield { type: 'thinking', text: ev.delta } satisfies LLMChunk
            break
          }
          case 'toolcall_end': {
            yield {
              type: 'tool_call',
              id: ev.toolCall.id,
              name: ev.toolCall.name,
              arguments: JSON.stringify(ev.toolCall.arguments ?? {}),
            } satisfies LLMChunk
            break
          }
          case 'done': {
            yield { type: 'done' } satisfies LLMChunk
            break
          }
          case 'error': {
            throw new Error(ev.message)
          }
          // text_start / text_end / thinking_start / thinking_end /
          // toolcall_start / toolcall_delta are not represented in LLMChunk
          // and are intentionally dropped — haklex assembles content from
          // delta + tool_call alone.
        }
      }
    },
  }
}
