import type {
  AssistantMessage,
  AssistantMessageEvent,
  JsonObject,
  Message as PiMessage,
  Usage,
} from '@earendil-works/pi-ai'
import type { AiAgentSseEvent } from '@mx-space/ai'
import type { RuntimeProviderInfo } from '@mx-space/ai/runtime'

export function toPiMessages(
  messages: Record<string, unknown>[],
  runtime: RuntimeProviderInfo,
): {
  systemPrompt: string | undefined
  piMessages: PiMessage[]
} {
  const systemParts: string[] = []
  const piMessages: PiMessage[] = []
  const ts = Date.now()

  for (const m of messages) {
    const role = String(m.role ?? '')
    if (role === 'system') {
      if (typeof m.content === 'string') systemParts.push(m.content)
      continue
    }
    if (role === 'user') {
      piMessages.push({
        role: 'user',
        content: typeof m.content === 'string' ? m.content : '',
        timestamp: ts,
      })
      continue
    }
    if (role === 'assistant') {
      piMessages.push({
        role: 'assistant',
        content: [{ type: 'text', text: String(m.content ?? '') }],
        api: runtime.api ?? 'openai-completions',
        provider: runtime.id,
        model: runtime.model,
        usage: zeroUsage(),
        stopReason: 'stop',
        timestamp: ts,
      } as AssistantMessage)
      continue
    }
    if (role === 'assistant_tool_call') {
      const toolCalls = Array.isArray(m.toolCalls) ? m.toolCalls : []
      const content: AssistantMessage['content'] = []
      if (typeof m.content === 'string' && m.content.length > 0) {
        content.push({ type: 'text', text: m.content })
      }
      for (const tc of toolCalls as Array<Record<string, unknown>>) {
        let args: unknown = tc.arguments
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args)
          } catch {
            args = {}
          }
        }
        content.push({
          type: 'toolCall',
          id: String(tc.id ?? ''),
          name: String(tc.name ?? ''),
          arguments: (args ?? {}) as JsonObject,
        })
      }
      piMessages.push({
        role: 'assistant',
        content,
        api: runtime.api ?? 'openai-completions',
        provider: runtime.id,
        model: runtime.model,
        usage: zeroUsage(),
        stopReason: 'toolUse',
        timestamp: ts,
      } as AssistantMessage)
      continue
    }
    if (role === 'tool_result') {
      piMessages.push({
        role: 'toolResult',
        toolCallId: String(m.toolCallId ?? ''),
        toolName: String(m.toolName ?? ''),
        content: [{ type: 'text', text: String(m.content ?? '') }],
        isError: Boolean(m.isError),
        timestamp: ts,
      })
      continue
    }
  }

  return {
    systemPrompt: systemParts.length > 0 ? systemParts.join('\n') : undefined,
    piMessages,
  }
}

export function bubblesToHistory(
  bubbles: readonly unknown[],
): Record<string, unknown>[] {
  const history: Record<string, unknown>[] = []
  for (const bubble of bubbles) {
    if (!bubble || typeof bubble !== 'object') continue
    const { type, content, streaming } = bubble as Record<string, unknown>
    if (typeof content !== 'string' || !content.trim()) continue
    if (type === 'user') history.push({ role: 'user', content })
    else if (type === 'assistant' && !streaming)
      history.push({ role: 'assistant', content })
  }
  return history
}

export function zeroUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

export function mapPiEventToSse(
  event: AssistantMessageEvent,
): AiAgentSseEvent | null {
  switch (event.type) {
    case 'text_start': {
      return { type: 'text_start', contentIndex: event.contentIndex }
    }
    case 'text_delta': {
      return {
        type: 'text_delta',
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    }
    case 'text_end': {
      return { type: 'text_end', contentIndex: event.contentIndex }
    }
    case 'thinking_start': {
      return { type: 'thinking_start', contentIndex: event.contentIndex }
    }
    case 'thinking_delta': {
      return {
        type: 'thinking_delta',
        contentIndex: event.contentIndex,
        delta: event.delta,
      }
    }
    case 'thinking_end': {
      return { type: 'thinking_end', contentIndex: event.contentIndex }
    }
    case 'toolcall_start': {
      const name = extractToolCallName(event.partial, event.contentIndex)
      return {
        type: 'toolcall_start',
        contentIndex: event.contentIndex,
        ...(name !== undefined ? { name } : {}),
      }
    }
    case 'toolcall_delta': {
      const partialArgs = safeParsePartialArgs(event.delta)
      return {
        type: 'toolcall_delta',
        contentIndex: event.contentIndex,
        partialArgs,
      }
    }
    case 'toolcall_end': {
      return {
        type: 'toolcall_end',
        contentIndex: event.contentIndex,
        toolCall: {
          id: event.toolCall.id,
          name: event.toolCall.name,
          arguments: event.toolCall.arguments ?? {},
        },
      }
    }
    case 'done': {
      return {
        type: 'done',
        message: event.message as unknown as Record<string, unknown>,
      }
    }
    case 'error': {
      return {
        type: 'error',
        reason: event.reason,
        message:
          event.error.errorMessage ??
          (event.reason === 'aborted' ? 'Stream aborted' : 'Stream error'),
      }
    }
    case 'start': {
      return null
    }
    default: {
      return null
    }
  }
}

function extractToolCallName(
  partial: unknown,
  contentIndex: number,
): string | undefined {
  const blocks = (partial as { content?: Array<Record<string, unknown>> })
    ?.content
  if (!Array.isArray(blocks)) return undefined
  const block = blocks[contentIndex]
  if (block && block.type === 'toolCall' && typeof block.name === 'string') {
    return block.name
  }
  return undefined
}

function safeParsePartialArgs(delta: string): Record<string, unknown> {
  if (!delta) return {}
  try {
    const parsed = JSON.parse(delta) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // partial JSON fragment — emit raw delta under a known key so the admin can
    // accumulate it without losing data.
    return { __partial: delta }
  }
  return {}
}
