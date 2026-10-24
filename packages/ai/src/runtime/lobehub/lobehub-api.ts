import type {
  AssistantMessage,
  Context,
  Model,
  ProviderStreamOptions,
  ToolCall,
} from '@earendil-works/pi-ai'
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai'
import { z } from 'zod'

import { CloudModelPricingSchema } from '../model-pricing'
import { PiRuntimeAdapter } from '../pi-runtime.adapter'
import { AIProviderType } from '../provider.types'
import { defaultTextProtocolAdapterRegistry } from '../text-protocol.registry'

export const LOBEHUB_BASE_URL = 'https://app.lobehub.com'
const API = 'lobehub-webapi'
interface LobeHubRuntimeOptions {
  getAccessToken: () => Promise<string>
  baseUrl?: string
}
let runtimeOptions: LobeHubRuntimeOptions
let registered = false

const cloudModels = z.object({
  models: z.array(
    z.object({
      id: z.string().min(1),
      displayName: z.string().nullish(),
      type: z.string(),
      enabled: z.boolean().optional(),
      pricing: CloudModelPricingSchema.optional().catch(undefined),
    }),
  ),
})

export function registerLobeHubRuntime(options: LobeHubRuntimeOptions) {
  runtimeOptions = options
  if (registered) return
  defaultTextProtocolAdapterRegistry.register({
    id: API,
    matches: (config) => config.providerType === AIProviderType.LobeHub,
    create: (config) => {
      const auth = runtimeOptions
      const baseUrl = (auth.baseUrl || LOBEHUB_BASE_URL).replace(/\/+$/, '')
      return new PiRuntimeAdapter(
        { ...config, endpoint: baseUrl, appendV1: false },
        {
          api: API,
          stream: (model, context, opts) =>
            streamLobeHub(baseUrl, auth, model, context, opts),
          listModels: async (capability) => {
            if (capability !== 'text') return []
            const response = await fetch(
              `${baseUrl}/webapi/lobehub-model-config`,
              {
                headers: { 'Oidc-Auth': await auth.getAccessToken() },
                signal: AbortSignal.timeout(15_000),
              },
            )
            await assertResponse(response)
            return cloudModels
              .parse(await response.json())
              .models.filter(
                (model) => model.type === 'chat' && model.enabled !== false,
              )
              .map((model) => ({
                id: model.id,
                name: model.displayName || model.id,
                ...(model.pricing
                  ? { pricing: { ...model.pricing, unit: 'token' as const } }
                  : {}),
              }))
          },
        },
      )
    },
  })
  registered = true
}

async function assertResponse(response: Response) {
  if (response.ok) return
  // Upstream error bodies can echo request content or credentials.
  const message =
    response.status === 401 || response.status === 403
      ? 'LobeHub session expired; reconnect your account'
      : response.status === 402
        ? 'LobeHub: insufficient credits'
        : response.status === 429
          ? 'LobeHub: rate limited'
          : `LobeHub request failed (${response.status})`
  throw new Error(message)
}

function cloudMessages(context: Context) {
  const messages: Record<string, unknown>[] = []
  if (context.systemPrompt)
    messages.push({ role: 'system', content: context.systemPrompt })
  for (const message of context.messages) {
    if (message.role === 'user') {
      messages.push({
        role: 'user',
        content:
          typeof message.content === 'string'
            ? message.content
            : message.content.map((part) =>
                part.type === 'text'
                  ? { type: 'text', text: part.text }
                  : {
                      type: 'image_url',
                      image_url: {
                        url: `data:${part.mimeType};base64,${part.data}`,
                      },
                    },
              ),
      })
    } else if (message.role === 'toolResult') {
      messages.push({
        role: 'tool',
        tool_call_id: message.toolCallId,
        content: message.content
          .map((part) =>
            part.type === 'text' ? part.text : `[image:${part.mimeType}]`,
          )
          .join('\n'),
      })
    } else if (message.role === 'assistant') {
      const calls = message.content.filter(
        (part): part is ToolCall => part.type === 'toolCall',
      )
      messages.push({
        role: 'assistant',
        content: message.content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join(''),
        ...(calls.length
          ? {
              tool_calls: calls.map((call) => ({
                id: call.id,
                type: 'function',
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.arguments),
                },
              })),
            }
          : {}),
      })
    }
  }
  return messages
}

function streamLobeHub(
  baseUrl: string,
  auth: LobeHubRuntimeOptions,
  model: Model<any>,
  context: Context,
  options?: ProviderStreamOptions,
) {
  const events = createAssistantMessageEventStream()
  const output: AssistantMessage = {
    role: 'assistant',
    api: API,
    provider: 'lobehub',
    model: model.id,
    content: [],
    stopReason: 'stop',
    timestamp: Date.now(),
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  }
  Object.assign(output.usage, { reportedCost: null })
  queueMicrotask(async () => {
    let active: { type: 'text' | 'thinking'; index: number } | undefined
    const calls = new Map<
      number,
      { call: ToolCall; raw: string; contentIndex: number }
    >()
    let stopped = false
    let stopReason = ''
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const partial = () => structuredClone(output)
    function endBlock() {
      if (!active) return
      const block = output.content[active.index]
      if (block.type === 'text')
        events.push({
          type: 'text_end',
          contentIndex: active.index,
          content: block.text,
          partial: partial(),
        })
      if (block.type === 'thinking')
        events.push({
          type: 'thinking_end',
          contentIndex: active.index,
          content: block.thinking,
          partial: partial(),
        })
      active = undefined
    }
    function consume(block: string) {
      const lines = block.split('\n')
      const type = lines
        .find((line) => line.startsWith('event:'))
        ?.slice(6)
        .trim()
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (!data) return
      if (data === '[DONE]') {
        stopped = true
        return
      }
      const decoded = JSON.parse(data)
      const delta =
        typeof decoded === 'string'
          ? decoded
          : (decoded?.text ?? decoded?.content ?? decoded?.delta)
      if (
        type === 'text' ||
        type === 'content_part' ||
        type === 'reasoning' ||
        type === 'reasoning_part'
      ) {
        if (typeof delta !== 'string' || !delta) return
        const kind =
          type === 'text' || type === 'content_part' ? 'text' : 'thinking'
        if (active?.type !== kind) {
          endBlock()
          active = { type: kind, index: output.content.length }
          output.content.push(
            kind === 'text'
              ? { type: 'text', text: '' }
              : { type: 'thinking', thinking: '' },
          )
          events.push({
            type: kind === 'text' ? 'text_start' : 'thinking_start',
            contentIndex: active.index,
            partial: partial(),
          })
        }
        const content = output.content[active!.index]
        if (content.type === 'text') content.text += delta
        if (content.type === 'thinking') content.thinking += delta
        events.push({
          type: kind === 'text' ? 'text_delta' : 'thinking_delta',
          contentIndex: active!.index,
          delta,
          partial: partial(),
        })
      } else if (type === 'tool_calls') {
        endBlock()
        const fragments = z
          .array(
            z.object({
              index: z.number().int().nonnegative().optional(),
              id: z.string().optional(),
              function: z
                .object({
                  name: z.string().optional(),
                  arguments: z.string().optional(),
                })
                .optional(),
            }),
          )
          .parse(Array.isArray(decoded) ? decoded : decoded?.tool_calls)
        for (const [position, fragment] of fragments.entries()) {
          const index = fragment.index ?? position
          let entry = calls.get(index)
          if (!entry) {
            const call: ToolCall = {
              type: 'toolCall',
              id: fragment.id || `call-${index}`,
              name: fragment.function?.name || '',
              arguments: {},
            }
            entry = { call, raw: '', contentIndex: output.content.length }
            calls.set(index, entry)
            output.content.push(call)
            events.push({
              type: 'toolcall_start',
              contentIndex: entry.contentIndex,
              partial: partial(),
            })
          }
          if (fragment.id) entry.call.id = fragment.id
          if (fragment.function?.name) entry.call.name = fragment.function.name
          const delta = fragment.function?.arguments || ''
          entry.raw += delta
          events.push({
            type: 'toolcall_delta',
            contentIndex: entry.contentIndex,
            delta,
            partial: partial(),
          })
        }
      } else if (type === 'usage') {
        const usage = decoded?.usage ?? decoded?.data ?? decoded
        const number = (value: unknown) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0
            ? value
            : 0
        const cacheRead = number(usage.inputCachedTokens ?? usage.cacheRead)
        const cacheWrite = number(
          usage.inputWriteCacheTokens ?? usage.cacheWrite,
        )
        const input = Math.max(
          0,
          number(usage.totalInputTokens ?? usage.inputTokens ?? usage.input) -
            cacheRead -
            cacheWrite,
        )
        const outputTokens = number(
          usage.totalOutputTokens ?? usage.outputTokens ?? usage.output,
        )
        const cost = usage.cost ?? usage.totalCost
        output.usage = Object.assign(
          {
            input,
            output: outputTokens,
            cacheRead,
            cacheWrite,
            reasoning: number(usage.outputReasoningTokens),
            totalTokens:
              typeof usage.totalTokens === 'number'
                ? number(usage.totalTokens)
                : input + cacheRead + cacheWrite + outputTokens,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: number(usage.cost ?? usage.totalCost),
            },
          },
          {
            // pi requires numeric costs; retain explicit billing knowledge for persistence.
            reportedCost:
              typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
                ? { total: cost }
                : null,
          },
        )
      } else if (type === 'stop') {
        stopped = true
        stopReason = typeof decoded === 'string' ? decoded : decoded?.reason
      } else if (type === 'error') {
        throw new Error(
          typeof decoded === 'string'
            ? decoded
            : typeof decoded?.message === 'string'
              ? decoded.message
              : 'LobeHub stream failed',
        )
      }
    }
    try {
      events.push({ type: 'start', partial: partial() })
      const token = await auth.getAccessToken()
      const payload = {
        model: model.id,
        messages: cloudMessages(context),
        stream: true,
        ...(context.tools?.length
          ? {
              tools: context.tools.map((tool) => ({
                type: 'function',
                function: tool,
              })),
            }
          : {}),
        ...(options?.temperature === undefined
          ? {}
          : { temperature: options.temperature }),
        ...(options?.maxTokens === undefined
          ? {}
          : { max_tokens: options.maxTokens }),
        ...(options?.reasoningEffort
          ? { reasoning_effort: options.reasoningEffort }
          : {}),
        ...(options?.toolChoice ? { tool_choice: options.toolChoice } : {}),
      }
      const response = await fetch(`${baseUrl}/webapi/chat/lobehub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Oidc-Auth': token },
        body: JSON.stringify(payload),
        signal: options?.signal,
      })
      await assertResponse(response)
      if (!response.body) throw new Error('LobeHub stream is empty')
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        buffer += decoder.decode(value, { stream: !done })
        buffer = buffer.replaceAll('\r\n', '\n')
        if (done && buffer.trim()) buffer += '\n\n'
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          consume(buffer.slice(0, boundary))
          buffer = buffer.slice(boundary + 2)
        }
        if (done) break
      }
      options?.signal?.throwIfAborted()
      if (!stopped) throw new Error('LobeHub stream incomplete')
      endBlock()
      for (const { call, raw, contentIndex } of calls.values()) {
        if (!call.name) throw new Error('LobeHub tool call has no name')
        call.arguments = z
          .record(z.string(), z.json())
          .parse(JSON.parse(raw || '{}'))
        events.push({
          type: 'toolcall_end',
          contentIndex,
          toolCall: call,
          partial: partial(),
        })
      }
      output.stopReason = calls.size
        ? 'toolUse'
        : stopReason === 'length'
          ? 'length'
          : 'stop'
      events.push({ type: 'done', reason: output.stopReason, message: output })
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? 'aborted' : 'error'
      output.errorMessage =
        error instanceof Error ? error.message : String(error)
      events.push({ type: 'error', reason: output.stopReason, error: output })
    } finally {
      await reader?.cancel().catch(() => {})
      events.end(output)
    }
  })
  return events
}
