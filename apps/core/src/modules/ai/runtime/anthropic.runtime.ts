import Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'

import { isDev } from '~/global/env.global'

import { buildAiSdkDefaultHeaders } from './ai-sdk-attribution'
import { BaseRuntime } from './base.runtime'
import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateTextStreamOptions,
  ModelInfo,
  RuntimeConfig,
  RuntimeProviderInfo,
  TextStreamChunk,
} from './types'

/** Prompt caching breakpoint (Anthropic Messages API). */
const EPHEMERAL_CACHE: Anthropic.CacheControlEphemeral = { type: 'ephemeral' }

function systemWithPromptCache(
  system: string | undefined,
): string | Anthropic.TextBlockParam[] | undefined {
  if (system === undefined || !system.trim()) {
    return undefined
  }
  return [
    {
      type: 'text',
      text: system,
      cache_control: EPHEMERAL_CACHE,
    },
  ]
}

function userContentWithPromptCache(
  text: string,
): Anthropic.ContentBlockParam[] {
  return [{ type: 'text', text, cache_control: EPHEMERAL_CACHE }]
}

// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODELS: ModelInfo[] = [
  // Claude 4.6
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  // Claude 4.5
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
  // Claude 4.1 / 4.0
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
  // Claude 3.7
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7' },
  // Claude 3.5
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet v2' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  // Claude 3
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
]

export class AnthropicRuntime extends BaseRuntime {
  readonly providerInfo: RuntimeProviderInfo
  private readonly client: Anthropic

  constructor(config: RuntimeConfig) {
    super()
    this.providerInfo = {
      id: config.providerId,
      type: config.providerType,
      model: config.model,
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.endpoint || undefined,
      defaultHeaders: buildAiSdkDefaultHeaders(),
    })
  }

  async generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const { prompt, messages, temperature, maxTokens, maxRetries = 2 } = options

    const anthropicMessages: Anthropic.MessageParam[] = messages
      ? messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
      : [
          {
            role: 'user' as const,
            content: userContentWithPromptCache(prompt!),
          },
        ]

    const systemMessage = messages?.find((m) => m.role === 'system')?.content

    return this.withRetry(async () => {
      const response = await this.client.messages.create({
        model: this.providerInfo.model,
        messages: anthropicMessages,
        system: systemWithPromptCache(systemMessage),
        temperature,
        max_tokens: maxTokens || 4096,
      })

      const textContent = response.content.find((c) => c.type === 'text')
      return {
        text: textContent?.text || '',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      }
    }, maxRetries)
  }

  async generateStructured<T extends z.ZodType>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<z.infer<T>>> {
    const {
      prompt,
      systemPrompt,
      schema,
      temperature,
      maxTokens,
      maxRetries = 2,
      // reasoningEffort is intentionally ignored for Anthropic
      // Extended thinking requires explicit enablement via 'thinking' parameter
      // which we don't use in structured output mode
    } = options

    const jsonSchema = this.zodToJsonSchema(schema)

    // Use tool use for structured output
    const tool: Anthropic.Tool = {
      name: 'structured_output',
      description: 'Generate structured output based on the given schema',
      input_schema: jsonSchema as Anthropic.Tool.InputSchema,
      cache_control: EPHEMERAL_CACHE,
    }

    return this.withRetry(async () => {
      const response = await this.client.messages.create({
        model: this.providerInfo.model,
        messages: [{ role: 'user', content: prompt }],
        system: systemWithPromptCache(systemPrompt),
        temperature,
        max_tokens: maxTokens || 4096,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'structured_output' },
      })

      const toolUseBlock = response.content.find((c) => c.type === 'tool_use')
      if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
        throw new Error('No tool use block in response')
      }

      return {
        output: toolUseBlock.input as z.infer<T>,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      }
    }, maxRetries)
  }

  async *generateTextStream(
    options: GenerateTextStreamOptions,
  ): AsyncIterable<TextStreamChunk> {
    const { prompt, messages, temperature, maxTokens } = options

    const anthropicMessages: Anthropic.MessageParam[] = messages
      ? messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
      : [
          {
            role: 'user' as const,
            content: userContentWithPromptCache(prompt!),
          },
        ]

    const systemMessage = messages?.find((m) => m.role === 'system')?.content

    const clientAny = this.client as any
    if (clientAny?.messages?.create) {
      try {
        const stream = await clientAny.messages.create(
          {
            model: this.providerInfo.model,
            messages: anthropicMessages,
            system: systemWithPromptCache(systemMessage),
            temperature,
            max_tokens: maxTokens || 4096,
            stream: true,
          },
          { signal: options.signal },
        )

        for await (const event of stream as AsyncIterable<any>) {
          const deltaText =
            event?.delta?.text || event?.content_block?.text || event?.text
          if (deltaText) {
            if (isDev) {
              // eslint-disable-next-line no-console
              console.debug(
                `[runtime:anthropic] chunk size=${deltaText.length}`,
              )
            }
            yield { text: deltaText }
          }
        }
        return
      } catch (error: any) {
        if (error?.name === 'AbortError') throw error
        // fallback to non-streaming
      }
    }

    const fallback = await this.generateText(options)
    if (fallback.text) {
      yield { text: fallback.text }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a public models API, return hardcoded list
    return ANTHROPIC_MODELS
  }
}
