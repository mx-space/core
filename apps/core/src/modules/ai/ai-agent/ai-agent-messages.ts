import type { AssistantMessageEvent } from '@earendil-works/pi-ai'
import type { AiAgentSseEvent } from '@mx-space/ai'

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
