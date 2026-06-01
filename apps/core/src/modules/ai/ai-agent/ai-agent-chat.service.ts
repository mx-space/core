import type {
  AssistantMessage,
  AssistantMessageEvent,
  Message as PiMessage,
  Usage,
} from '@earendil-works/pi-ai'
import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'

import type { AIProviderConfig } from '../ai.types'
import { AIProviderType } from '../ai.types'
import { createModelRuntime } from '../runtime'
import { convert as convertJsonSchema } from '../runtime/json-schema-to-typebox'

const AI_SDK_ATTRIBUTION_HEADERS = {
  'X-Title': 'Mix Space',
  'HTTP-Referer': 'https://github.com/mx-space/core',
} as const

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
}

@Injectable()
export class AiAgentChatService {
  private readonly logger = new Logger(AiAgentChatService.name)

  constructor(private readonly configService: ConfigsService) {}

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

    const { systemPrompt, piMessages } = this.toPiMessages(options.messages)

    const events = runtime.streamMessage({
      messages: piMessages,
      systemPrompt,
      tools,
      signal: options.signal,
    })

    try {
      for await (const event of events) {
        yield event
      }
    } catch (error) {
      this.logger.debug(`streamChat caught error: ${(error as Error).message}`)
      throw error
    }
  }

  private toPiMessages(messages: Record<string, unknown>[]): {
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
          api: 'openai-completions',
          provider: 'openai',
          model: '',
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
          api: 'openai-completions',
          provider: 'openai',
          model: '',
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

  /**
   * Legacy fetch-based proxy. Retained until step-12 rewires the controller to
   * consume streamChat directly; do not extend.
   */
  buildRequestBody(
    provider: AIProviderConfig,
    model: string,
    messages: Record<string, unknown>[],
    tools?: ChatToolInput[],
  ): { url: string; headers: Record<string, string>; body: string } {
    if (provider.type === AIProviderType.Anthropic) {
      return this.buildClaudeRequest(provider, model, messages, tools)
    }
    return this.buildOpenAIRequest(provider, model, messages, tools)
  }

  private buildClaudeRequest(
    provider: AIProviderConfig,
    model: string,
    messages: Record<string, unknown>[],
    tools?: ChatToolInput[],
  ) {
    const systemMsgs = messages.filter((m) => m.role === 'system')
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system')

    const claudeMessages = nonSystemMsgs.map((m) => {
      if (m.role === 'user') return { role: 'user', content: m.content }
      if (m.role === 'assistant')
        return { role: 'assistant', content: m.content }
      if (m.role === 'assistant_tool_call') {
        return {
          role: 'assistant',
          content: (m.toolCalls as any[]).map((tc) => ({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments as string),
          })),
        }
      }
      if (m.role === 'tool_result') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: m.content,
              is_error: m.isError,
            },
          ],
        }
      }
      return { role: m.role, content: m.content }
    })

    const claudeTools = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }))

    const body: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      stream: true,
      messages: claudeMessages,
    }

    if (systemMsgs.length > 0) {
      body.system = systemMsgs.map((m) => ({ type: 'text', text: m.content }))
    }
    if (claudeTools?.length) {
      body.tools = claudeTools
    }
    if (model.includes('opus') || model.includes('sonnet')) {
      body.thinking = { type: 'enabled', budget_tokens: 2048 }
    }

    const baseUrl = provider.endpoint || 'https://api.anthropic.com/v1'

    return {
      url: `${baseUrl}/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
        ...AI_SDK_ATTRIBUTION_HEADERS,
      },
      body: JSON.stringify(body),
    }
  }

  private buildOpenAIRequest(
    provider: AIProviderConfig,
    model: string,
    messages: Record<string, unknown>[],
    tools?: ChatToolInput[],
  ) {
    const openaiMessages = messages.map((m) => {
      if (m.role === 'system') return { role: 'system', content: m.content }
      if (m.role === 'user') return { role: 'user', content: m.content }
      if (m.role === 'assistant')
        return { role: 'assistant', content: m.content }
      if (m.role === 'assistant_tool_call') {
        return {
          role: 'assistant',
          content: null,
          tool_calls: (m.toolCalls as any[]).map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        }
      }
      if (m.role === 'tool_result') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        }
      }
      return { role: m.role, content: m.content }
    })

    const openaiTools = tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    const body: Record<string, unknown> = {
      model,
      stream: true,
      messages: openaiMessages,
    }
    if (openaiTools?.length) {
      body.tools = openaiTools
    }

    let baseUrl: string
    if (provider.endpoint) {
      baseUrl = provider.endpoint
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = `${baseUrl.replace(/\/+$/, '')}/v1`
      }
    } else {
      baseUrl = 'https://api.openai.com/v1'
    }

    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        ...AI_SDK_ATTRIBUTION_HEADERS,
      },
      body: JSON.stringify(body),
    }
  }
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
