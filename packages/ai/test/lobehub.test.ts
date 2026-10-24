import { Type } from 'typebox'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createModelRuntime } from '../src/runtime/ai-provider.factory'
import { registerLobeHubRuntime } from '../src/runtime/lobehub/lobehub-api'
import { AIProviderType } from '../src/runtime/provider.types'

let responseBody = ''
let request: { url: string; headers: Headers; body: any }
const getAccessToken = vi.fn(async () => 'oauth-access')

registerLobeHubRuntime({ getAccessToken })

function runtime(onUsage?: (usage: import('../src/runtime/types').RuntimeUsage | undefined) => void) {
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    request = {
      url,
      headers: new Headers(init.headers),
      body: init.body ? JSON.parse(String(init.body)) : null,
    }
    const bytes = new TextEncoder().encode(responseBody)
    return new Response(new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
        controller.close()
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } })
  })
  return createModelRuntime({
    id: 'cloud', name: 'LobeHub', type: AIProviderType.LobeHub,
    apiKey: '', endpoint: 'https://untrusted.example', defaultModel: 'test-model', enabled: true,
  }, undefined, { onUsage })
}

afterEach(() => { vi.unstubAllGlobals(); getAccessToken.mockClear() })

describe('LobeHub runtime', () => {
  it.each([0.001, null])('accumulates structured retries without losing unknown cost (%s)', async (firstCost) => {
    const terminal = 'event: stop\ndata: "stop"\n\n'
    const usage = (cost: number | null) => 'event: usage\ndata: ' + JSON.stringify({ totalInputTokens: 100, inputCachedTokens: 20, inputWriteCacheTokens: 10, totalOutputTokens: 5, ...(cost === null ? {} : { cost }) }) + '\n\n'
    responseBody = 'event: text\ndata: "retry"\n\n' + usage(firstCost) + terminal
    const onUsage = vi.fn(() => {
      responseBody = 'event: tool_calls\ndata: [{"id":"call","function":{"name":"structured_output","arguments":"{\\\"answer\\\":42}"}}]\n\n' + usage(0.002) + terminal
    })
    const result = await runtime(onUsage).generateStructured({ prompt: 'answer', schema: Type.Object({ answer: Type.Number() }) })
    expect(onUsage).toHaveBeenCalledTimes(2)
    expect(result.usage).toMatchObject({ inputTokens: 140, outputTokens: 10, cacheReadTokens: 40, cacheWriteTokens: 20, totalTokens: 210 })
    if (firstCost === null) expect(result.usage?.costBreakdown).toBeNull()
    else expect(result.usage?.cost).toBeCloseTo(0.003)
  })

  it.each(['text', 'textStream', 'message', 'structured', 'structuredStream'])('reports usage exactly once before %s generation returns', async (method) => {
    const onUsage = vi.fn()
    const model = runtime(onUsage)
    const structured = method.startsWith('structured')
    responseBody = (structured
      ? 'event: tool_calls\ndata: [{"id":"call","function":{"name":"structured_output","arguments":"{\\\"answer\\\":42}"}}]\n\n'
      : 'event: text\ndata: "ok"\n\n') + 'event: usage\ndata: {"totalInputTokens":10,"totalOutputTokens":2,"cost":0}\n\nevent: stop\ndata: "stop"\n\n'
    const options = { prompt: 'answer', schema: Type.Object({ answer: Type.Number() }) }
    if (method === 'text') await model.generateText(options)
    else if (method === 'structured') await model.generateStructured(options)
    else if (method === 'message') await model.streamMessage!({ messages: [{ role: 'user', content: 'hi' }] }).result()
    else {
      const events = method === 'textStream' ? model.generateTextStream!(options) : model.streamStructured!(options)
      for await (const _event of events) { /* consume */ }
    }
    expect(onUsage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ inputTokens: 10, outputTokens: 2, cost: 0 }))
  })

  it('preserves model billing rules received from the cloud catalogue', async () => {
    const modelRuntime = runtime()
    vi.stubGlobal('fetch', async () => Response.json({ models: [{ id: 'priced', type: 'chat', pricing: { units: [
      { name: 'textInput', strategy: 'fixed', unit: 'millionTokens', rate: 2 },
      { name: 'textOutput', strategy: 'tiered', unit: 'millionTokens', tiers: [{ upTo: 100000, rate: 6 }, { upTo: 'infinity', rate: 12 }] },
      { name: 'textInput_cacheWrite', strategy: 'lookup', unit: 'millionTokens', lookup: { pricingParams: ['ttl'], prices: { '5m': 2.5, '1h': 4 } } },
    ] } }] }))
    const [model] = await modelRuntime.listModels!()
    expect(model.pricing?.units).toHaveLength(3)
    expect(model.pricing?.units?.[1]).toMatchObject({ strategy: 'tiered', tiers: [{ upTo: 100000, rate: 6 }, { upTo: 'infinity', rate: 12 }] })
    expect(model.pricing?.units?.[2]).toMatchObject({ lookup: { prices: { '5m': 2.5, '1h': 4 } } })
  })

  it('separates cached input and derives totals while retaining the reported dollar cost', async () => {
    responseBody = 'event: text\ndata: "ok"\n\nevent: usage\ndata: {"totalInputTokens":120,"inputCachedTokens":30,"inputWriteCacheTokens":20,"totalOutputTokens":10,"outputReasoningTokens":4,"cost":0.002}\n\nevent: stop\ndata: "stop"\n\n'
    const result = await runtime().generateText({ prompt: 'hello' })
    expect(result.usage).toMatchObject({ inputTokens: 70, outputTokens: 10, cacheReadTokens: 30, cacheWriteTokens: 20, totalTokens: 130, cost: 0.002 })
    expect(result.usage?.costBreakdown).toEqual({ total: 0.002 })
  })

  it('keeps missing cost unknown instead of treating credits or absent usage as free', async () => {
    for (const event of ['', 'event: usage\ndata: {"totalInputTokens":10,"totalOutputTokens":2,"credits":100}\n\n']) {
      responseBody = 'event: text\ndata: "ok"\n\n' + event + 'event: stop\ndata: "stop"\n\n'
      const result = await runtime().generateText({ prompt: 'hello' })
      expect(result.usage?.cost).toBeUndefined()
      expect(result.usage?.costBreakdown).toBeNull()
    }
  })

  it('retains cache usage and unknown cost through structured output', async () => {
    responseBody = 'event: tool_calls\ndata: [{"id":"call","function":{"name":"structured_output","arguments":"{\\"answer\\":42}"}}]\n\nevent: usage\ndata: {"totalInputTokens":100,"inputCachedTokens":40,"inputWriteCacheTokens":10,"totalOutputTokens":5}\n\nevent: stop\ndata: "tool_calls"\n\n'
    const result = await runtime().generateStructured({ prompt: 'answer', schema: Type.Object({ answer: Type.Number() }) })
    expect(result.usage).toMatchObject({ inputTokens: 50, cacheReadTokens: 40, cacheWriteTokens: 10, totalTokens: 105 })
    expect(result.usage?.costBreakdown).toBeNull()
  })

  it('generates text from fragmented cloud SSE using server credentials and the trusted origin', async () => {
    responseBody = 'event: text\r\ndata: "你好"\r\n\r\nevent: text\ndata: "，世界"\n\nevent: usage\ndata: {"totalInputTokens":12,"totalOutputTokens":4,"totalTokens":16}\n\nevent: stop\ndata: "stop"\n\n'
    const result = await runtime().generateText({ prompt: 'hello', reasoningEffort: 'high' })
    expect(result.text).toBe('你好，世界')
    expect(result.usage?.totalTokens).toBe(16)
    expect(request.url).toBe('https://app.lobehub.com/webapi/chat/lobehub')
    expect(request.headers.get('Oidc-Auth')).toBe('oauth-access')
    expect(request.headers.has('X-lobe-trace')).toBe(false)
    expect(request.body).toMatchObject({ model: 'test-model', reasoning_effort: 'high', messages: [{ role: 'user', content: 'hello' }] })
  })

  it('assembles fragmented tool arguments for validated structured generation', async () => {
    responseBody = 'event: tool_calls\ndata: [{"index":0,"id":"call_1","function":{"name":"structured_output","arguments":"{\\"answer\\":"}}]\n\nevent: tool_calls\ndata: [{"index":0,"function":{"arguments":"42}"}}]\n\nevent: stop\ndata: "tool_calls"\n\n'
    const result = await runtime().generateStructured({ prompt: 'answer', schema: Type.Object({ answer: Type.Number() }) })
    expect(result.output).toEqual({ answer: 42 })
    expect(request.body.tool_choice).toEqual({ type: 'function', function: { name: 'structured_output' } })
  })

  it('rejects incomplete streams instead of saving a truncated answer', async () => {
    responseBody = 'event: text\ndata: "partial"\n\n'
    await expect(runtime().generateText({ prompt: 'hello' })).rejects.toThrow(/incomplete/i)
  })

  it('surfaces cloud errors and invalid tool arguments', async () => {
    responseBody = 'event: error\ndata: {"message":"Insufficient credits"}\n\n'
    await expect(runtime().generateText({ prompt: 'hello' })).rejects.toThrow('Insufficient credits')
    responseBody = 'event: tool_calls\ndata: [{"index":0,"id":"bad","function":{"name":"broken","arguments":"{"}}]\n\nevent: stop\ndata: "tool_calls"\n\n'
    await expect(runtime().generateText({ prompt: 'hello' })).rejects.toThrow()
  })

  it('lists only enabled chat models without sending credentials to a configured endpoint', async () => {
    const modelRuntime = runtime()
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      request = { url, headers: new Headers(init.headers), body: null }
      return Response.json({ models: [
        { id: 'chat-a', displayName: 'Chat A', type: 'chat', enabled: true },
        { id: 'disabled', type: 'chat', enabled: false },
        { id: 'image', type: 'image', enabled: true },
      ] })
    })
    expect(await modelRuntime.listModels!()).toEqual([{ id: 'chat-a', name: 'Chat A' }])
    expect(request.url).toBe('https://app.lobehub.com/webapi/lobehub-model-config')
    expect(request.headers.get('Oidc-Auth')).toBe('oauth-access')
    expect(await modelRuntime.listModels!('image')).toEqual([])
  })
})
