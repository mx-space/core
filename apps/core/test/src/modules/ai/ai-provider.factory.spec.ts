import { registerBuiltInApiProviders } from '@earendil-works/pi-ai/compat'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AIProviderType } from '~/modules/ai/ai.types'
import { createModelRuntime } from '~/modules/ai/runtime'
import { PiRuntimeAdapter } from '~/modules/ai/runtime/pi-runtime.adapter'

interface AdapterInternals {
  api: 'openai-completions' | 'anthropic-messages'
  buildStreamOptions: (options: object) => {
    headers?: Record<string, string | null>
  }
  piProviderId: string
}

function inspect(adapter: unknown): AdapterInternals {
  return adapter as unknown as AdapterInternals
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createModelRuntime — enum coverage', () => {
  it('constructs PiRuntimeAdapter with openai-completions api for OpenAICompatible', () => {
    const runtime = createModelRuntime({
      id: 'deepseek',
      name: 'DeepSeek',
      type: AIProviderType.OpenAICompatible,
      apiKey: 'sk-xxx',
      endpoint: 'https://api.deepseek.com',
      defaultModel: 'deepseek-chat',
      enabled: true,
    })
    expect(runtime).toBeInstanceOf(PiRuntimeAdapter)
    expect(runtime.providerInfo.type).toBe(AIProviderType.OpenAICompatible)
    expect(runtime.providerInfo.model).toBe('deepseek-chat')
    expect(runtime.providerInfo.api).toBe('openai-completions')
    expect(inspect(runtime).api).toBe('openai-completions')
  })

  it('constructs PiRuntimeAdapter with anthropic-messages api for Anthropic', () => {
    const runtime = createModelRuntime({
      id: 'claude',
      name: 'Claude',
      type: AIProviderType.Anthropic,
      apiKey: 'sk-ant-xxx',
      endpoint: 'https://api.anthropic.com',
      defaultModel: 'claude-sonnet-4-20250514',
      enabled: true,
    })
    expect(runtime).toBeInstanceOf(PiRuntimeAdapter)
    expect(runtime.providerInfo.type).toBe(AIProviderType.Anthropic)
    expect(runtime.providerInfo.model).toBe('claude-sonnet-4-20250514')
    expect(runtime.providerInfo.api).toBe('anthropic-messages')
    expect(inspect(runtime).api).toBe('anthropic-messages')
  })

  it('constructs PiRuntimeAdapter with openai-completions api for Generic', () => {
    const runtime = createModelRuntime({
      id: 'custom',
      name: 'Custom',
      type: AIProviderType.Generic,
      apiKey: 'sk-xxx',
      endpoint: 'https://custom.example.com',
      defaultModel: 'custom-model',
      enabled: true,
    })
    expect(runtime).toBeInstanceOf(PiRuntimeAdapter)
    expect(runtime.providerInfo.type).toBe(AIProviderType.Generic)
    expect(inspect(runtime).api).toBe('openai-completions')
  })

  it('constructs a Vertex text runtime over its OpenAI-compatible endpoint', () => {
    const runtime = createModelRuntime({
      id: 'vertex',
      name: 'Vertex',
      type: AIProviderType.GoogleVertex,
      apiKey: 'vertex-key',
      projectId: 'example-project',
      endpoint:
        'https://aiplatform.googleapis.com/v1/projects/example-project/locations/global/endpoints/openapi',
      defaultModel: 'google/gemini-3.6-flash',
      enabled: true,
    })
    expect(runtime).toBeInstanceOf(PiRuntimeAdapter)
    expect(runtime.providerInfo.type).toBe(AIProviderType.GoogleVertex)
    expect(runtime.providerInfo.api).toBe('openai-completions')
    expect(inspect(runtime).api).toBe('openai-completions')
    expect(inspect(runtime).piProviderId).toBe('google-vertex')
    expect(inspect(runtime).buildStreamOptions({}).headers).toEqual({
      Authorization: null,
      'x-goog-api-key': 'vertex-key',
    })
  })

  it('uses model override when provided', () => {
    const runtime = createModelRuntime(
      {
        id: 'openai',
        name: 'OpenAI',
        type: AIProviderType.OpenAICompatible,
        apiKey: 'sk-xxx',
        endpoint: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o',
        enabled: true,
      },
      'gpt-4o-mini',
    )
    expect(runtime.providerInfo.model).toBe('gpt-4o-mini')
  })

  it('sends the runtime session id on OpenRouter requests', async () => {
    registerBuiltInApiProviders()
    const requestHeaders: Headers[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      requestHeaders.push(
        new Headers(input instanceof Request ? input.headers : init?.headers),
      )
      return new Response(
        JSON.stringify({ error: { message: 'expected test stop' } }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    })
    const runtime = createModelRuntime(
      {
        id: 'openrouter',
        name: 'OpenRouter',
        type: AIProviderType.OpenAICompatible,
        apiKey: 'sk-xxx',
        endpoint: 'https://openrouter.ai/api/v1',
        defaultModel: 'openai/gpt-4o-mini',
        enabled: true,
      },
      undefined,
      { sessionId: 'business-session' },
    )

    if (!runtime.streamMessage) throw new Error('streamMessage is unavailable')
    const events = runtime.streamMessage({
      messages: [{ role: 'user', content: 'probe' }],
    })
    for await (const _event of events) {
      // Consume the expected provider error event.
    }

    expect(requestHeaders).toHaveLength(1)
    expect(requestHeaders[0]?.get('x-session-id')).toBe('business-session')
  })

  it('throws for unsupported provider type', () => {
    expect(() =>
      createModelRuntime({
        id: 'unknown',
        name: 'Unknown',
        type: 'unknown' as AIProviderType,
        apiKey: 'sk-xxx',
        defaultModel: 'model',
        enabled: true,
      }),
    ).toThrow('No protocol adapter supports the runtime configuration')
  })
})

describe('createModelRuntime — piProviderId derivation', () => {
  function build(
    type: AIProviderType,
    endpoint: string | undefined,
  ): AdapterInternals {
    const runtime = createModelRuntime({
      id: 'cfg',
      name: 'cfg',
      type,
      apiKey: 'sk-xxx',
      endpoint,
      defaultModel: 'm',
      enabled: true,
    })
    return inspect(runtime)
  }

  // Known hostnames map to canonical pi provider ids regardless of provider
  // type. We exercise each known host with its most natural type pairing.
  it('derives openrouter from openrouter.ai', () => {
    expect(
      build(AIProviderType.OpenAICompatible, 'https://openrouter.ai/api/v1')
        .piProviderId,
    ).toBe('openrouter')
  })
  it('derives deepseek from api.deepseek.com', () => {
    expect(
      build(AIProviderType.OpenAICompatible, 'https://api.deepseek.com')
        .piProviderId,
    ).toBe('deepseek')
  })
  it('derives openai from api.openai.com', () => {
    expect(
      build(AIProviderType.OpenAICompatible, 'https://api.openai.com/v1')
        .piProviderId,
    ).toBe('openai')
  })
  it('derives anthropic from api.anthropic.com', () => {
    expect(
      build(AIProviderType.Anthropic, 'https://api.anthropic.com').piProviderId,
    ).toBe('anthropic')
  })

  // Unknown hostname → type-based fallback for each of the 3 enum values.
  it('falls back to anthropic for unknown host + Anthropic', () => {
    expect(
      build(AIProviderType.Anthropic, 'https://unknown.example.com')
        .piProviderId,
    ).toBe('anthropic')
  })
  it('falls back to openai for unknown host + OpenAICompatible', () => {
    expect(
      build(AIProviderType.OpenAICompatible, 'https://unknown.example.com')
        .piProviderId,
    ).toBe('openai')
  })
  it('falls back to openai-compat for unknown host + Generic', () => {
    expect(
      build(AIProviderType.Generic, 'https://unknown.example.com').piProviderId,
    ).toBe('openai-compat')
  })

  // Empty / undefined endpoint → type-based fallback for each of the 3 enum
  // values. `createRuntimeForModelList` exercises this when no endpoint is
  // configured for the live model-list fetch.
  it('falls back to anthropic for empty endpoint + Anthropic', () => {
    expect(build(AIProviderType.Anthropic, undefined).piProviderId).toBe(
      'anthropic',
    )
  })
  it('falls back to openai for empty endpoint + OpenAICompatible', () => {
    expect(build(AIProviderType.OpenAICompatible, undefined).piProviderId).toBe(
      'openai',
    )
  })
  it('falls back to openai-compat for empty endpoint + Generic', () => {
    expect(build(AIProviderType.Generic, undefined).piProviderId).toBe(
      'openai-compat',
    )
  })
})
