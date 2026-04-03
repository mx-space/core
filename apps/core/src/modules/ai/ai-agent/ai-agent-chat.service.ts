import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { ConfigsService } from '~/modules/configs/configs.service'

import type { AIProviderConfig } from '../ai.types'
import { AIProviderType } from '../ai.types'
import { buildAiSdkDefaultHeaders } from '../runtime/ai-sdk-attribution'

@Injectable()
export class AiAgentChatService {
  private readonly logger = new Logger(AiAgentChatService.name)

  constructor(private readonly configService: ConfigsService) {}

  /**
   * Resolve provider config by ID from AI settings.
   */
  async resolveProvider(providerId: string): Promise<AIProviderConfig> {
    const aiConfig = await this.configService.get('ai')
    const provider = aiConfig.providers?.find(
      (p) => p.id === providerId && p.enabled,
    )
    if (!provider) {
      throw new BizException(
        ErrorCodeEnum.AINotEnabled,
        `Provider "${providerId}" not found or disabled`,
      )
    }
    return provider
  }

  /**
   * Build provider-specific request body from generic ChatMessage format.
   * Mirrors buildClaudeBody/buildOpenAIBody from @haklex/rich-agent-core.
   */
  buildRequestBody(
    provider: AIProviderConfig,
    model: string,
    messages: Record<string, unknown>[],
    tools?: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
    }>,
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
    tools?: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
    }>,
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
        ...buildAiSdkDefaultHeaders(),
      },
      body: JSON.stringify(body),
    }
  }

  private buildOpenAIRequest(
    provider: AIProviderConfig,
    model: string,
    messages: Record<string, unknown>[],
    tools?: Array<{
      name: string
      description: string
      parameters: Record<string, unknown>
    }>,
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
    if (provider.type === AIProviderType.OpenRouter) {
      baseUrl = provider.endpoint || 'https://openrouter.ai/api/v1'
    } else if (provider.type === AIProviderType.OpenAI) {
      baseUrl = provider.endpoint || 'https://api.openai.com/v1'
    } else {
      baseUrl = provider.endpoint!
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = `${baseUrl.replace(/\/+$/, '')}/v1`
      }
    }

    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
        ...buildAiSdkDefaultHeaders(),
      },
      body: JSON.stringify(body),
    }
  }
}
