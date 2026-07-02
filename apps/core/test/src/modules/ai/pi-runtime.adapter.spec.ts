import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  Type,
} from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import {
  deriveProviderId,
  PiRuntimeAdapter,
  resolveOpenAICompatibleBaseUrl,
} from '~/modules/ai/runtime/pi-runtime.adapter'

const MODEL_ID = 'faux-model'

const FAUX_API = 'openai-completions'

const PROVIDER_ID = 'faux-provider'

interface AdapterHandle {
  adapter: PiRuntimeAdapter
  teardown: () => void
}

interface AdapterInternals {
  model: {
    api: string
    baseUrl: string
    provider: string
    compat?: { supportsStore?: boolean }
  }
}

function inspect(adapter: unknown): AdapterInternals {
  return adapter as unknown as AdapterInternals
}

function makeAdapter(
  opts: {
    providerType?: AIProviderType
    providerId?: string
    endpoint?: string
    contextWindow?: number
    maxTokens?: number
  } = {},
): AdapterHandle {
  const faux = withFauxAi({
    api: FAUX_API,
    provider: opts.providerId ?? PROVIDER_ID,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
  })
  const providerType = opts.providerType ?? AIProviderType.OpenAICompatible
  const adapter = new PiRuntimeAdapter({
    apiKey: 'faux-api-key',
    endpoint:
      opts.endpoint ?? `https://${opts.providerId ?? PROVIDER_ID}.example.com`,
    model: MODEL_ID,
    providerType,
    providerId: opts.providerId ?? PROVIDER_ID,
    contextWindow: opts.contextWindow,
    maxTokens: opts.maxTokens,
  })
  return {
    adapter,
    teardown: () => faux.teardown(),
  }
}

const handles: AdapterHandle[] = []

function track<T extends AdapterHandle>(handle: T): T {
  handles.push(handle)
  return handle
}

afterEach(() => {
  while (handles.length) handles.pop()!.teardown()
  vi.restoreAllMocks()
})

function adapterWithResponses(
  responses: ReturnType<typeof fauxAssistantMessage>[],
  opts: Parameters<typeof makeAdapter>[0] = {},
): PiRuntimeAdapter {
  // Re-register matching the adapter's derived api ('openai-completions' for
  // OpenAICompatible/Generic; 'anthropic-messages' for Anthropic). Make the
  // adapter resolve to a custom model literal whose .api matches the faux api,
  // so the registry maps to the faux stream fn.
  const providerType = opts.providerType ?? AIProviderType.OpenAICompatible
  const fauxApi =
    providerType === AIProviderType.Anthropic
      ? 'anthropic-messages'
      : 'openai-completions'
  const faux = withFauxAi({
    api: fauxApi,
    provider: opts.providerId ?? PROVIDER_ID,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses,
  })
  const adapter = new PiRuntimeAdapter({
    apiKey: 'faux-api-key',
    endpoint:
      opts.endpoint ?? `https://${opts.providerId ?? PROVIDER_ID}.example.com`,
    model: MODEL_ID,
    providerType,
    providerId: opts.providerId ?? PROVIDER_ID,
    contextWindow: opts.contextWindow,
    maxTokens: opts.maxTokens,
  })
  track({ adapter, teardown: () => faux.teardown() })
  return adapter
}

describe('PiRuntimeAdapter', () => {
  describe('deriveProviderId', () => {
    it('maps openrouter.ai -> openrouter', () => {
      expect(
        deriveProviderId(
          'https://openrouter.ai/api/v1',
          AIProviderType.OpenAICompatible,
        ),
      ).toBe('openrouter')
    })
    it('maps api.deepseek.com -> deepseek', () => {
      expect(
        deriveProviderId(
          'https://api.deepseek.com',
          AIProviderType.OpenAICompatible,
        ),
      ).toBe('deepseek')
    })
    it('maps api.openai.com -> openai', () => {
      expect(
        deriveProviderId(
          'https://api.openai.com/v1',
          AIProviderType.OpenAICompatible,
        ),
      ).toBe('openai')
    })
    it('maps api.anthropic.com -> anthropic', () => {
      expect(
        deriveProviderId('https://api.anthropic.com', AIProviderType.Anthropic),
      ).toBe('anthropic')
    })
    it('falls back to type-based on unknown host (anthropic)', () => {
      expect(
        deriveProviderId(
          'https://unknown.example.com',
          AIProviderType.Anthropic,
        ),
      ).toBe('anthropic')
    })
    it('falls back to type-based on unknown host (openai-compatible)', () => {
      expect(
        deriveProviderId(
          'https://unknown.example.com',
          AIProviderType.OpenAICompatible,
        ),
      ).toBe('openai')
    })
    it('falls back to type-based on unknown host (generic)', () => {
      expect(
        deriveProviderId('https://unknown.example.com', AIProviderType.Generic),
      ).toBe('openai-compat')
    })
    it('falls back to type-based on empty endpoint', () => {
      expect(deriveProviderId('', AIProviderType.Anthropic)).toBe('anthropic')
      expect(deriveProviderId(undefined, AIProviderType.OpenAICompatible)).toBe(
        'openai',
      )
      expect(deriveProviderId('  ', AIProviderType.Generic)).toBe(
        'openai-compat',
      )
    })
    it('falls back to type-based on invalid URL', () => {
      expect(deriveProviderId('not-a-url', AIProviderType.Anthropic)).toBe(
        'anthropic',
      )
    })
  })

  describe('generateText', () => {
    it('returns text from a single text block', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage('hello world'),
      ])
      const result = await adapter.generateText({ prompt: 'hi' })
      expect(result.text).toBe('hello world')
    })

    it('concatenates thinking-then-text by ignoring thinking', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([
          fauxThinking('reasoning...'),
          fauxText('final answer'),
        ]),
      ])
      const result = await adapter.generateText({ prompt: 'hi' })
      expect(result.text).toBe('final answer')
    })

    it('concatenates multiple text blocks in order', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([fauxText('part one '), fauxText('part two')]),
      ])
      const result = await adapter.generateText({ prompt: 'hi' })
      expect(result.text).toBe('part one part two')
    })

    it('throws when no text content is present', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([fauxToolCall('foo', { x: 1 })]),
      ])
      await expect(adapter.generateText({ prompt: 'hi' })).rejects.toThrow(
        /no text content/i,
      )
    })

    it('surfaces usage cost.total via mapUsage with null-safety', async () => {
      const adapter = adapterWithResponses([fauxAssistantMessage('ok')])
      const result = await adapter.generateText({ prompt: 'hi' })
      // mapped usage always returns an object with cost defaulted to 0
      expect(result.usage).toBeDefined()
    })
  })

  describe('generateStructured', () => {
    const schema = Type.Object(
      {
        title: Type.String(),
        score: Type.Number(),
      },
      { additionalProperties: false },
    )

    it('validate:true returns parsed output (happy path)', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([
          fauxToolCall('structured_output', { title: 'hello', score: 7 }),
        ]),
      ])
      const result = await adapter.generateStructured({
        prompt: 'go',
        schema,
      })
      expect(result.output).toEqual({ title: 'hello', score: 7 })
    })

    it('validate:false returns raw output without schema check', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([
          fauxToolCall('structured_output', { title: 'hello', extra: 1 }),
        ]),
      ])
      const result = await adapter.generateStructured({
        prompt: 'go',
        schema,
        validate: false,
      })
      // extra is present because validation skipped
      expect((result.output as Record<string, unknown>).title).toBe('hello')
      expect((result.output as Record<string, unknown>).extra).toBe(1)
    })

    it('validate:false JSON-string arguments are parsed to object', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([
          fauxToolCall(
            'structured_output',
            JSON.stringify({ title: 's', score: 1 }) as never,
          ),
        ]),
      ])
      const result = await adapter.generateStructured({
        prompt: 'go',
        schema,
        validate: false,
      })
      expect(result.output).toEqual({ title: 's', score: 1 })
    })

    it('throws maxIterations when only text replies arrive 5x', async () => {
      const replies = Array.from({ length: 5 }, () =>
        fauxAssistantMessage('still thinking'),
      )
      const adapter = adapterWithResponses(replies)
      await expect(
        adapter.generateStructured({ prompt: 'go', schema }),
      ).rejects.toThrow(/structured output after 5 iterations/i)
    })

    it('throws AbortError when signal pre-aborted', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([
          fauxToolCall('structured_output', { title: 't', score: 1 }),
        ]),
      ])
      const controller = new AbortController()
      controller.abort()
      await expect(
        adapter.generateStructured({
          prompt: 'go',
          schema,
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('text-then-toolcall on retry succeeds', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage('one moment...'),
        fauxAssistantMessage([
          fauxToolCall('structured_output', { title: 'done', score: 9 }),
        ]),
      ])
      const result = await adapter.generateStructured({
        prompt: 'go',
        schema,
      })
      expect(result.output).toEqual({ title: 'done', score: 9 })
    })
  })

  describe('generateTextStream', () => {
    it('yields only non-empty string deltas', async () => {
      const adapter = adapterWithResponses([fauxAssistantMessage('abcdef')])
      const chunks: string[] = []
      for await (const chunk of adapter.generateTextStream({ prompt: 'hi' })) {
        expect(typeof chunk.text).toBe('string')
        expect(chunk.text.length).toBeGreaterThan(0)
        chunks.push(chunk.text)
      }
      expect(chunks.join('')).toBe('abcdef')
    })

    it('throws on error event from pi stream', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage('boom', {
          stopReason: 'error',
          errorMessage: 'upstream blew up',
        }),
      ])
      await expect(async () => {
        for await (const _ of adapter.generateTextStream({ prompt: 'hi' })) {
          // consume
        }
      }).rejects.toThrow(/upstream blew up/)
    })
  })

  describe('streamMessage', () => {
    it('returns pi event stream verbatim', async () => {
      const adapter = adapterWithResponses([
        fauxAssistantMessage([
          fauxThinking('thinking-bytes'),
          fauxText('answer'),
        ]),
      ])
      const events = adapter.streamMessage({
        messages: [{ role: 'user', content: 'hi' }],
      })
      const types: string[] = []
      for await (const event of events) {
        types.push(event.type)
      }
      expect(types).toContain('text_delta')
      expect(types).toContain('done')
    })
  })

  describe('model resolve', () => {
    it('resolves registered model from pi registry when available', () => {
      // Adapter constructor calls resolveModel; registered = faux model
      const { adapter } = track(makeAdapter())
      expect(adapter.providerInfo.model).toBe(MODEL_ID)
    })

    it('honors a custom endpoint even when a registered OpenAI model matches', () => {
      const faux = withFauxAi({
        api: FAUX_API,
        provider: 'openai',
        models: [
          {
            id: 'gpt-5.5',
            name: 'gpt-5.5',
            baseUrl: 'https://api.openai.com/v1',
          },
        ],
      })
      const adapter = new PiRuntimeAdapter({
        apiKey: 'faux-api-key',
        endpoint: 'https://api.example.com/v1',
        model: 'gpt-5.5',
        providerType: AIProviderType.OpenAICompatible,
        providerId: 'custom-openai-compatible',
      })
      track({ adapter, teardown: () => faux.teardown() })

      expect(inspect(adapter).model).toMatchObject({
        api: FAUX_API,
        baseUrl: 'https://api.example.com/v1',
        provider: 'openai',
      })
    })

    it('falls back to custom literal when pi registry misses', () => {
      // Unregistered provider id -> registry miss -> custom literal
      const { adapter } = track(
        makeAdapter({
          providerId: 'totally-not-registered',
          providerType: AIProviderType.OpenAICompatible,
          endpoint: 'https://unknown.example.com',
          contextWindow: 1234,
          maxTokens: 567,
        }),
      )
      expect(adapter.providerInfo.id).toBe('totally-not-registered')
      // No throw on construction is the contract; behaviour covered in generateText
    })

    it('appends /v1 to custom endpoint by default', () => {
      const { adapter } = track(
        makeAdapter({
          providerId: 'not-registered-v1',
          endpoint: 'https://unknown.example.com/openai/',
        }),
      )
      expect(inspect(adapter).model.baseUrl).toBe(
        'https://unknown.example.com/openai/v1',
      )
    })

    it('keeps custom endpoint verbatim when appendV1 is false', () => {
      const faux = withFauxAi({
        api: FAUX_API,
        provider: PROVIDER_ID,
        models: [{ id: MODEL_ID, name: MODEL_ID }],
      })
      const adapter = new PiRuntimeAdapter({
        apiKey: 'faux-api-key',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        appendV1: false,
        model: MODEL_ID,
        providerType: AIProviderType.OpenAICompatible,
        providerId: 'gemini-compat',
      })
      track({ adapter, teardown: () => faux.teardown() })
      expect(inspect(adapter).model.baseUrl).toBe(
        'https://generativelanguage.googleapis.com/v1beta/openai',
      )
    })

    it('disables supportsStore for non-OpenAI compat hosts', () => {
      const { adapter } = track(
        makeAdapter({
          providerId: 'not-registered-store',
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        }),
      )
      expect(inspect(adapter).model.compat).toMatchObject({
        supportsStore: false,
      })
    })

    it('keeps compat untouched for api.openai.com', () => {
      const { adapter } = track(
        makeAdapter({
          providerId: 'not-registered-openai',
          endpoint: 'https://api.openai.com/v1',
        }),
      )
      expect(inspect(adapter).model.compat).toBeUndefined()
    })
  })

  describe('resolveOpenAICompatibleBaseUrl', () => {
    it('defaults to the OpenAI base URL on empty endpoint', () => {
      expect(resolveOpenAICompatibleBaseUrl(undefined)).toBe(
        'https://api.openai.com/v1',
      )
      expect(resolveOpenAICompatibleBaseUrl('  ')).toBe(
        'https://api.openai.com/v1',
      )
    })

    it('appends /v1 when missing and enabled', () => {
      expect(resolveOpenAICompatibleBaseUrl('https://example.com')).toBe(
        'https://example.com/v1',
      )
      expect(resolveOpenAICompatibleBaseUrl('https://example.com/v1/')).toBe(
        'https://example.com/v1',
      )
    })

    it('only trims trailing slashes when disabled', () => {
      expect(
        resolveOpenAICompatibleBaseUrl('https://example.com/openai/', false),
      ).toBe('https://example.com/openai')
    })
  })

  describe('listModels', () => {
    function adapterWithModelListUrl() {
      return new PiRuntimeAdapter({
        apiKey: 'faux-api-key',
        endpoint: 'https://example.com/openai',
        modelListUrl: 'https://example.com/openai/models',
        model: MODEL_ID,
        providerType: AIProviderType.OpenAICompatible,
        providerId: 'model-list-test',
      })
    }

    it('fetches from modelListUrl when configured', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'models/gemini-2.5-flash' }, { id: 'gemini-pro' }],
        }),
      } as Response)

      await expect(adapterWithModelListUrl().listModels()).resolves.toEqual([
        { id: 'models/gemini-2.5-flash', name: 'models/gemini-2.5-flash' },
        { id: 'gemini-pro', name: 'gemini-pro' },
      ])
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/openai/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer faux-api-key' },
        }),
      )
    })

    it('propagates a non-2xx modelListUrl response as an error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
      } as Response)

      await expect(adapterWithModelListUrl().listModels()).rejects.toThrow(
        /401/,
      )
    })
  })

  describe('prompt cache placeholder', () => {
    it('accepts cacheRetention option (forward-compat placeholder)', async () => {
      const adapter = adapterWithResponses([fauxAssistantMessage('ok')])
      // generateText path does not yet wire cacheRetention; assert that callers
      // can include it as a hint without runtime rejection.
      const result = await adapter.generateText({
        prompt: 'hi',
        // @ts-expect-error: forward-compat placeholder; not part of types yet
        cacheRetention: '5m',
      })
      expect(result.text).toBe('ok')
    })
  })

  describe('abort propagation', () => {
    it('propagates abort signal to pi stream (signal pre-aborted)', async () => {
      const adapter = adapterWithResponses([fauxAssistantMessage('hello')])
      const controller = new AbortController()
      controller.abort()
      await expect(async () => {
        for await (const _ of adapter.generateTextStream({
          prompt: 'hi',
          signal: controller.signal,
        })) {
          // consume
        }
      }).rejects.toBeDefined()
    })
  })
})
