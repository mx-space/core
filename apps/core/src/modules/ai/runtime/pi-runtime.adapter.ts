import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Message as PiMessage,
  Model,
  ProviderStreamOptions,
  Static,
  Tool,
  TSchema,
} from '@earendil-works/pi-ai'
import {
  complete,
  getModel,
  getModels,
  isContextOverflow,
  stream,
  validateToolCall,
} from '@earendil-works/pi-ai'
import { Logger } from '@nestjs/common'

import { isDev } from '~/global/env.global'

import { AIProviderType } from '../ai.types'
import type { IModelRuntime } from './model-runtime.interface'
import type {
  GenerateStructuredOptions,
  GenerateStructuredResult,
  GenerateTextOptions,
  GenerateTextResult,
  GenerateTextStreamOptions,
  Message,
  ModelInfo,
  ReasoningEffort,
  RuntimeConfig,
  RuntimeProviderInfo,
  StreamMessageOptions,
  StructuredStreamChunk,
  TextStreamChunk,
} from './types'

export { isContextOverflow }

const STRUCTURED_TOOL_NAME = 'structured_output'
const DEFAULT_CONTEXT_WINDOW = 128_000
const DEFAULT_MAX_TOKENS = 8192
const STRUCTURED_MAX_ITERATIONS = 5

const HOSTNAME_TO_PROVIDER_ID: Record<string, string> = {
  'openrouter.ai': 'openrouter',
  'api.deepseek.com': 'deepseek',
  'api.openai.com': 'openai',
  'api.anthropic.com': 'anthropic',
}

function fallbackProviderId(type: AIProviderType): string {
  switch (type) {
    case AIProviderType.Anthropic: {
      return 'anthropic'
    }
    case AIProviderType.OpenAICompatible: {
      return 'openai'
    }
    default: {
      return 'openai-compat'
    }
  }
}

export function deriveProviderId(
  endpoint: string | undefined,
  type: AIProviderType,
): string {
  if (!endpoint || !endpoint.trim()) {
    return fallbackProviderId(type)
  }
  try {
    const { hostname } = new URL(endpoint)
    return HOSTNAME_TO_PROVIDER_ID[hostname] ?? fallbackProviderId(type)
  } catch {
    return fallbackProviderId(type)
  }
}

function providerTypeToApi(type: AIProviderType): Api {
  return type === AIProviderType.Anthropic
    ? 'anthropic-messages'
    : 'openai-completions'
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface PiUsageLike {
  input?: number
  output?: number
  totalTokens?: number
  cost?: { total?: number }
}

type MappedUsage = NonNullable<GenerateTextResult['usage']> & {
  cost?: number
}

function mapUsage(usage: PiUsageLike | undefined): MappedUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  return {
    promptTokens: usage.input,
    completionTokens: usage.output,
    totalTokens: usage.totalTokens,
    cost: usage.cost?.total ?? 0,
  }
}

interface ThinkingOptions {
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  thinkingEnabled?: boolean
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

function mapReasoningEffort(
  effort: ReasoningEffort | undefined,
  api: Api,
): ThinkingOptions {
  if (!effort || effort === 'none') return {}
  if (api === 'anthropic-messages') {
    return { thinkingEnabled: true, effort }
  }
  return { reasoningEffort: effort }
}

interface PiRuntimeAdapterConfig extends RuntimeConfig {
  contextWindow?: number | null
  maxTokens?: number | null
}

export class PiRuntimeAdapter implements IModelRuntime {
  readonly providerInfo: RuntimeProviderInfo
  private readonly logger = new Logger(PiRuntimeAdapter.name)
  private readonly api: Api
  private readonly piProviderId: string
  private readonly model: Model<Api>
  private readonly apiKey: string

  constructor(config: PiRuntimeAdapterConfig) {
    this.providerInfo = {
      id: config.providerId,
      type: config.providerType,
      model: config.model,
    }
    this.apiKey = config.apiKey
    this.api = providerTypeToApi(config.providerType)
    this.piProviderId = deriveProviderId(config.endpoint, config.providerType)
    this.model = this.resolveModel(
      config.model,
      config.endpoint,
      config.contextWindow ?? undefined,
      config.maxTokens ?? undefined,
    )
  }

  private resolveModel(
    modelId: string,
    endpoint: string | undefined,
    contextWindow?: number,
    maxTokens?: number,
  ): Model<Api> {
    try {
      const registered = getModel(
        this.piProviderId as never,
        modelId as never,
      ) as Model<Api> | undefined
      if (registered) return registered
    } catch {
      // miss falls through to custom literal
    }
    return {
      id: modelId,
      name: modelId,
      api: this.api,
      provider: this.piProviderId,
      baseUrl: endpoint ?? '',
      reasoning: false,
      input: ['text'],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: contextWindow ?? DEFAULT_CONTEXT_WINDOW,
      maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS,
      compat: undefined,
    } as Model<Api>
  }

  private buildContext(options: {
    prompt?: string
    messages?: (Message | PiMessage)[]
    systemPrompt?: string
    tools?: Tool[]
  }): Context {
    const { prompt, messages, systemPrompt, tools } = options
    const ts = Date.now()
    const systemFromMessages = messages?.find(
      (m): m is Message & { role: 'system' } =>
        m.role === 'system' && typeof (m as Message).content === 'string',
    )?.content
    const list: PiMessage[] = messages
      ? messages
          .filter((m) => m.role !== 'system')
          .map((m): PiMessage => {
            if (this.isPiMessage(m)) return m
            const thin = m as Message
            if (thin.role === 'assistant') {
              return {
                role: 'assistant',
                content: [{ type: 'text', text: thin.content }],
                api: this.api,
                provider: this.piProviderId,
                model: this.providerInfo.model,
                usage: undefined as never,
                stopReason: 'stop',
                timestamp: ts,
              } as unknown as PiMessage
            }
            return {
              role: 'user',
              content: thin.content,
              timestamp: ts,
            } as PiMessage
          })
      : prompt !== undefined
        ? [{ role: 'user', content: prompt, timestamp: ts } as PiMessage]
        : []
    return {
      systemPrompt: systemPrompt ?? systemFromMessages,
      messages: list,
      tools,
    }
  }

  private isPiMessage(value: Message | PiMessage): value is PiMessage {
    if (value.role === 'user') {
      return typeof (value as PiMessage).timestamp === 'number'
    }
    if (value.role === 'assistant') {
      return Array.isArray((value as PiMessage & { role: 'assistant' }).content)
    }
    if ((value as PiMessage).role === 'toolResult') {
      return true
    }
    return false
  }

  private buildStreamOptions(opts: {
    temperature?: number
    maxTokens?: number
    maxRetries?: number
    signal?: AbortSignal
    reasoningEffort?: ReasoningEffort
    toolChoice?: unknown
  }): ProviderStreamOptions {
    const thinking = mapReasoningEffort(opts.reasoningEffort, this.api)
    const result: ProviderStreamOptions = {
      apiKey: this.apiKey,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      maxRetries: opts.maxRetries,
      signal: opts.signal,
      ...thinking,
    }
    if (opts.toolChoice !== undefined) {
      ;(result as Record<string, unknown>).toolChoice = opts.toolChoice
    }
    return result
  }

  async generateText(
    options: GenerateTextOptions,
  ): Promise<GenerateTextResult> {
    const context = this.buildContext({
      prompt: options.prompt,
      messages: options.messages,
    })
    const piOptions = this.buildStreamOptions({
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      maxRetries: options.maxRetries,
      signal: options.signal,
      reasoningEffort: options.reasoningEffort,
    })

    const message = await complete(this.model, context, piOptions)
    if (message.stopReason === 'error' || message.stopReason === 'aborted') {
      throw new Error(
        message.errorMessage || `pi stream ended with ${message.stopReason}`,
      )
    }

    const textParts: string[] = []
    for (const block of message.content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      }
    }
    if (textParts.length === 0) {
      throw new Error('pi response contained no text content blocks')
    }
    return {
      text: textParts.join(''),
      usage: mapUsage(message.usage),
    }
  }

  async generateStructured<T extends TSchema>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<Static<T>>> {
    const typed = options

    const tool: Tool = {
      name: STRUCTURED_TOOL_NAME,
      description: 'Generate structured output based on the given schema',
      parameters: typed.schema,
    }
    const tools: Tool[] = [tool]

    const baseContext = this.buildContext({
      prompt: typed.prompt,
      systemPrompt: typed.systemPrompt,
      tools,
    })

    const piOptions = this.buildStreamOptions({
      temperature: typed.temperature,
      maxTokens: typed.maxTokens,
      maxRetries: typed.maxRetries,
      signal: typed.signal,
      reasoningEffort: typed.reasoningEffort,
      toolChoice:
        this.api === 'anthropic-messages'
          ? { type: 'tool', name: STRUCTURED_TOOL_NAME }
          : { type: 'function', function: { name: STRUCTURED_TOOL_NAME } },
    })

    const conversation: Context = {
      ...baseContext,
      messages: [...baseContext.messages],
    }
    const usageAccum: PiUsageLike = {
      input: 0,
      output: 0,
      totalTokens: 0,
      cost: { total: 0 },
    }

    for (let i = 0; i < STRUCTURED_MAX_ITERATIONS; i++) {
      if (typed.signal?.aborted) {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }

      const message = await complete(this.model, conversation, piOptions)

      if (message.stopReason === 'error' || message.stopReason === 'aborted') {
        throw new Error(
          message.errorMessage || `pi stream ended with ${message.stopReason}`,
        )
      }

      const u = message.usage as PiUsageLike | undefined
      if (u) {
        usageAccum.input = (usageAccum.input ?? 0) + (u.input ?? 0)
        usageAccum.output = (usageAccum.output ?? 0) + (u.output ?? 0)
        usageAccum.totalTokens =
          (usageAccum.totalTokens ?? 0) + (u.totalTokens ?? 0)
        usageAccum.cost = {
          total: (usageAccum.cost?.total ?? 0) + (u.cost?.total ?? 0),
        }
      }

      const toolCall = message.content.find((c) => c.type === 'toolCall') as
        | {
            type: 'toolCall'
            id: string
            name: string
            arguments: unknown
          }
        | undefined

      if (!toolCall) {
        conversation.messages.push(message)
        continue
      }

      let args: unknown = toolCall.arguments
      if (typeof args === 'string') {
        args = JSON.parse(args)
      }
      if (!isObjectRecord(args)) {
        throw new Error(
          'pi tool call arguments are neither an object nor JSON-parseable string',
        )
      }

      let output: unknown = args
      if (typed.validate !== false) {
        output = validateToolCall(tools, {
          type: 'toolCall',
          id: toolCall.id,
          name: toolCall.name,
          arguments: args as Record<string, unknown>,
        })
      }

      return {
        output: output as Static<T>,
        usage: mapUsage(usageAccum),
      }
    }

    throw new Error(
      `Failed to get structured output after ${STRUCTURED_MAX_ITERATIONS} iterations`,
    )
  }

  async *generateTextStream(
    options: GenerateTextStreamOptions,
  ): AsyncIterable<TextStreamChunk> {
    const context = this.buildContext({
      prompt: options.prompt,
      messages: options.messages,
    })
    const piOptions = this.buildStreamOptions({
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      maxRetries: options.maxRetries,
      signal: options.signal,
      reasoningEffort: options.reasoningEffort,
    })

    const events = stream(this.model, context, piOptions)

    for await (const event of events) {
      if (event.type === 'error') {
        const errMsg =
          (event.error as AssistantMessage | undefined)?.errorMessage ||
          `pi stream ended with ${event.reason}`
        throw new Error(errMsg)
      }
      if (event.type !== 'text_delta') continue
      const delta = (event as { delta?: unknown }).delta
      if (typeof delta !== 'string' || delta.length === 0) continue
      if (isDev) {
        // eslint-disable-next-line no-console
        console.debug(`[runtime:pi] chunk size=${delta.length}: ${delta}`)
      }
      yield { text: delta }
    }
  }

  streamMessage(options: StreamMessageOptions): AssistantMessageEventStream {
    const context = this.buildContext({
      messages: options.messages,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
    })
    const piOptions = this.buildStreamOptions({
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      maxRetries: options.maxRetries,
      signal: options.signal,
      reasoningEffort: options.reasoningEffort,
    })
    return stream(this.model, context, piOptions)
  }

  streamStructured<T extends TSchema>(
    _options: GenerateStructuredOptions<T>,
  ): AsyncIterable<StructuredStreamChunk<Static<T>>> {
    throw new Error('streamStructured reserved for spec 2')
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const models = getModels(this.piProviderId as never) as Model<Api>[]
      return models.map((m) => ({ id: m.id, name: m.name }))
    } catch (error) {
      this.logger.warn(
        `pi getModels failed for provider ${this.piProviderId}: ${
          (error as Error).message
        }`,
      )
      return []
    }
  }
}
