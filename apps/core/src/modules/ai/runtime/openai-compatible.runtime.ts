import { isDev } from '~/global/env.global'
import OpenAI from 'openai'
import type { z } from 'zod'
import { AIProviderType } from '../ai.types'
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

export class OpenAICompatibleRuntime extends BaseRuntime {
  readonly providerInfo: RuntimeProviderInfo
  private readonly client: OpenAI

  constructor(config: RuntimeConfig) {
    super()
    this.providerInfo = {
      id: config.providerId,
      type: config.providerType,
      model: config.model,
    }

    const baseURL = this.resolveBaseURL(config)
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL,
    })
  }

  private resolveBaseURL(config: RuntimeConfig): string {
    if (config.providerType === AIProviderType.OpenRouter) {
      return config.endpoint || 'https://openrouter.ai/api/v1'
    }
    if (config.providerType === AIProviderType.OpenAI) {
      return config.endpoint || 'https://api.openai.com/v1'
    }
    // OpenAI Compatible - endpoint is required
    if (!config.endpoint) {
      throw new Error(
        `Endpoint is required for OpenAI-compatible provider: ${config.providerId}`,
      )
    }
    return this.normalizeEndpoint(config.endpoint)
  }

  private normalizeEndpoint(endpoint: string): string {
    let normalized = endpoint.replace(/\/+$/, '')
    if (!normalized.endsWith('/v1')) {
      normalized = `${normalized}/v1`
    }
    return normalized
  }

  async generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const { prompt, messages, temperature, maxTokens, maxRetries = 2 } = options

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = messages
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: 'user', content: prompt! }]

    return this.withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.providerInfo.model,
        messages: chatMessages,
        temperature,
        max_tokens: maxTokens,
      })

      const choice = response.choices[0]
      return {
        text: choice?.message?.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
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
      reasoningEffort,
    } = options

    const jsonSchema = this.zodToJsonSchema(schema)

    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    // Map reasoningEffort to OpenAI's reasoning_effort parameter
    // 'none' means no reasoning, so we don't pass the parameter
    const openaiReasoningEffort =
      reasoningEffort && reasoningEffort !== 'none'
        ? reasoningEffort
        : undefined

    const toolConfig = {
      tools: [
        {
          type: 'function' as const,
          function: {
            name: 'structured_output',
            description: 'Generate structured output based on the given schema',
            parameters: jsonSchema,
          },
        },
      ],
      tool_choice: {
        type: 'function' as const,
        function: { name: 'structured_output' },
      },
    }

    return this.withRetry(async () => {
      // Some models may output thinking content before calling the tool
      // Loop until we get a tool call or reach max iterations
      const maxIterations = 5
      const conversationMessages = [...messages]
      const totalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }

      for (let i = 0; i < maxIterations; i++) {
        const response = await this.client.chat.completions.create({
          model: this.providerInfo.model,
          messages: conversationMessages,
          temperature,
          max_tokens: maxTokens,
          reasoning_effort: openaiReasoningEffort,
          ...toolConfig,
        } as OpenAI.ChatCompletionCreateParamsNonStreaming)

        if (response.usage) {
          totalUsage.promptTokens += response.usage.prompt_tokens
          totalUsage.completionTokens += response.usage.completion_tokens
          totalUsage.totalTokens += response.usage.total_tokens
        }

        const message = response.choices[0]?.message
        const toolCall = message?.tool_calls?.[0] as
          | { type: 'function'; function: { name: string; arguments: string } }
          | undefined

        if (toolCall?.function.name === 'structured_output') {
          const parsed = JSON.parse(toolCall.function.arguments) as z.infer<T>
          return {
            output: parsed,
            usage: totalUsage.totalTokens > 0 ? totalUsage : undefined,
          }
        }

        // No tool call yet, append assistant message and continue
        if (message?.content) {
          conversationMessages.push({
            role: 'assistant',
            content: message.content,
          })
        } else {
          // No content and no tool call, something is wrong
          throw new Error('No tool call or content in response')
        }
      }

      throw new Error(
        `Failed to get structured output after ${maxIterations} iterations`,
      )
    }, maxRetries)
  }

  async *generateTextStream(
    options: GenerateTextStreamOptions,
  ): AsyncIterable<TextStreamChunk> {
    const { prompt, messages, temperature, maxTokens } = options

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = messages
      ? messages.map((m) => ({ role: m.role, content: m.content }))
      : [{ role: 'user', content: prompt! }]

    const response = await this.client.chat.completions.create({
      model: this.providerInfo.model,
      messages: chatMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    })

    for await (const chunk of response) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) {
        if (isDev) {
          // eslint-disable-next-line no-console
          console.debug(`[runtime:openai] chunk size=${delta.length}`)
        }
        yield { text: delta }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await this.client.models.list({
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const models: ModelInfo[] = []
      for await (const model of response) {
        const id = (model.id || '').toLowerCase()
        // Filter out non-chat models
        if (
          id.includes('embedding') ||
          id.includes('whisper') ||
          id.includes('tts') ||
          id.includes('dall-e') ||
          id.includes('moderation') ||
          id.includes('davinci') ||
          id.includes('babbage') ||
          id.includes('ada') ||
          id.includes('curie')
        ) {
          continue
        }
        models.push({
          id: model.id,
          name: model.id,
          created: model.created,
        })
      }

      // Sort by creation time, newest first
      return models.sort((a, b) => (b.created || 0) - (a.created || 0))
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Request timeout after 10s')
      }
      throw error
    }
  }
}
