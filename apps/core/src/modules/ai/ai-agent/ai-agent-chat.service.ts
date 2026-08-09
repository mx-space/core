import type {
  AssistantMessage,
  AssistantMessageEvent,
  Message as PiMessage,
  TextContent,
  ThinkingContent,
  ToolCall,
  Usage,
} from '@earendil-works/pi-ai'
import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'

import type { AIProviderConfig } from '../ai.types'
import type { RuntimeProviderInfo } from '../runtime'
import { createModelRuntime } from '../runtime'
import { convert as convertJsonSchema } from '../runtime/json-schema-to-typebox'
import { AiAgentConversationRepository } from './ai-agent-conversation.repository'

interface ChatToolInput {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface StreamChatOptions {
  model: string
  providerId: string
  messages: Record<string, unknown>[]
  tools?: ChatToolInput[]
  signal?: AbortSignal
  conversationId?: string
}

interface ContentSlot {
  type: 'text' | 'thinking' | 'toolCall'
  buffer: string
  toolCall?: ToolCall
}

@Injectable()
export class AiAgentChatService {
  private readonly logger = new Logger(AiAgentChatService.name)

  constructor(
    private readonly configService: ConfigsService,
    private readonly conversationRepository: AiAgentConversationRepository,
  ) {}

  async resolveProvider(providerId: string): Promise<AIProviderConfig> {
    const aiConfig = await this.configService.get('ai')
    const provider = aiConfig.providers?.find(
      (p) => p.id === providerId && p.enabled,
    )
    if (!provider) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: `Provider "${providerId}" not found or disabled`,
      })
    }
    return provider
  }

  async *streamChat(
    options: StreamChatOptions,
  ): AsyncIterable<AssistantMessageEvent> {
    const provider = await this.resolveProvider(options.providerId)
    const runtime = createModelRuntime(provider, options.model)

    if (!runtime.streamMessage) {
      throw new Error('runtime does not implement streamMessage')
    }

    const tools = (options.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: convertJsonSchema(t.parameters, { toolName: t.name }),
    }))

    const { systemPrompt, piMessages } = toPiMessages(
      options.messages,
      runtime.providerInfo,
    )

    const events = runtime.streamMessage({
      messages: piMessages,
      systemPrompt,
      tools,
      signal: options.signal,
    })

    const slots = new Map<number, ContentSlot>()
    let finalUsage: Usage | undefined
    let finalMessage: AssistantMessage | undefined
    let terminated: 'done' | 'error' | 'abort' | undefined

    try {
      for await (const event of events) {
        switch (event.type) {
          case 'text_start': {
            slots.set(event.contentIndex, { type: 'text', buffer: '' })
            break
          }
          case 'text_delta': {
            const slot = ensureSlot(slots, event.contentIndex, 'text')
            slot.buffer += event.delta
            break
          }
          case 'text_end': {
            const slot = ensureSlot(slots, event.contentIndex, 'text')
            slot.buffer = event.content
            break
          }
          case 'thinking_start': {
            slots.set(event.contentIndex, { type: 'thinking', buffer: '' })
            break
          }
          case 'thinking_delta': {
            const slot = ensureSlot(slots, event.contentIndex, 'thinking')
            slot.buffer += event.delta
            break
          }
          case 'thinking_end': {
            const slot = ensureSlot(slots, event.contentIndex, 'thinking')
            slot.buffer = event.content
            break
          }
          case 'toolcall_start': {
            slots.set(event.contentIndex, { type: 'toolCall', buffer: '' })
            break
          }
          case 'toolcall_delta': {
            // partial tool_call payloads are intentionally dropped — only the
            // toolcall_end event commits a complete ToolCall block.
            break
          }
          case 'toolcall_end': {
            const slot = ensureSlot(slots, event.contentIndex, 'toolCall')
            slot.toolCall = event.toolCall
            break
          }
          case 'done': {
            finalMessage = event.message
            finalUsage = event.message.usage
            terminated = 'done'
            break
          }
          case 'error': {
            finalMessage = event.error
            finalUsage = event.error.usage
            terminated =
              event.reason === 'aborted' || options.signal?.aborted
                ? 'abort'
                : 'error'
            break
          }
          default: {
            break
          }
        }
        yield event
      }
    } catch (error) {
      if (options.signal?.aborted) {
        terminated = 'abort'
      } else {
        terminated = 'error'
      }
      this.logger.debug(`streamChat caught error: ${(error as Error).message}`)
      throw error
    } finally {
      if (options.conversationId) {
        const draft =
          finalMessage ??
          this.buildDraftAssistantMessage({
            slots,
            usage: finalUsage,
            runtime: runtime.providerInfo,
            terminated: terminated ?? 'abort',
          })
        await this.persistAssistantMessage(options.conversationId, draft).catch(
          (err) =>
            this.logger.warn(
              `Failed to persist assistant message: ${(err as Error).message}`,
            ),
        )
      }
    }
  }

  private buildDraftAssistantMessage(args: {
    slots: Map<number, ContentSlot>
    usage: Usage | undefined
    runtime: RuntimeProviderInfo
    terminated: 'done' | 'error' | 'abort'
  }): AssistantMessage {
    const indexes = [...args.slots.keys()].sort((a, b) => a - b)
    const content: AssistantMessage['content'] = []
    for (const idx of indexes) {
      const slot = args.slots.get(idx)!
      if (slot.type === 'text') {
        if (slot.buffer.length > 0) {
          content.push({ type: 'text', text: slot.buffer } as TextContent)
        }
        continue
      }
      if (slot.type === 'thinking') {
        if (slot.buffer.length > 0) {
          content.push({
            type: 'thinking',
            thinking: slot.buffer,
          } as ThinkingContent)
        }
        continue
      }
      if (slot.type === 'toolCall' && slot.toolCall) {
        content.push(slot.toolCall)
      }
    }
    return {
      role: 'assistant',
      content,
      api: args.runtime.api ?? 'openai-completions',
      provider: args.runtime.id,
      model: args.runtime.model,
      usage: args.usage ?? zeroUsage(),
      stopReason: args.terminated === 'abort' ? 'aborted' : 'stop',
      timestamp: Date.now(),
    }
  }

  private async persistAssistantMessage(
    conversationId: string,
    message: AssistantMessage,
  ): Promise<void> {
    const existing = await this.conversationRepository.findById(conversationId)
    if (!existing) return
    await this.conversationRepository.update(conversationId, {
      messages: [...existing.messages, message],
    })
  }
}

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
          arguments: (args ?? {}) as Record<string, unknown>,
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

function ensureSlot(
  slots: Map<number, ContentSlot>,
  index: number,
  type: ContentSlot['type'],
): ContentSlot {
  let slot = slots.get(index)
  if (!slot) {
    slot = { type, buffer: '' }
    slots.set(index, slot)
  }
  return slot
}

function zeroUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}
