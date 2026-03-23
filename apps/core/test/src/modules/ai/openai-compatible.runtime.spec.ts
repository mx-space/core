import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { AIProviderType } from '../../../../src/modules/ai/ai.types'
import { OpenAICompatibleRuntime } from '../../../../src/modules/ai/runtime/openai-compatible.runtime'

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: createMock,
      },
    }

    constructor(_: unknown) {}
  },
}))

describe('OpenAICompatibleRuntime prompt caching', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('adds Vercel gateway automatic caching to text requests', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'cached' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
      },
    })

    const runtime = new OpenAICompatibleRuntime({
      apiKey: 'test-key',
      endpoint: 'https://ai-gateway.vercel.sh',
      model: 'anthropic/claude-sonnet-4.6',
      providerType: AIProviderType.OpenAICompatible,
      providerId: 'vercel-gateway',
    })

    await runtime.generateText({ prompt: 'hello' })

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      providerOptions: {
        gateway: {
          caching: 'auto',
        },
      },
    })
  })

  it('does not add gateway caching to non-gateway compatible endpoints', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'plain' } }],
      usage: {
        prompt_tokens: 8,
        completion_tokens: 1,
        total_tokens: 9,
      },
    })

    const runtime = new OpenAICompatibleRuntime({
      apiKey: 'test-key',
      endpoint: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      providerType: AIProviderType.OpenAICompatible,
      providerId: 'deepseek',
    })

    await runtime.generateText({ prompt: 'hello' })

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0]?.[0]).not.toHaveProperty('providerOptions')
  })

  it('does not add gateway caching to default OpenRouter requests', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'plain' } }],
      usage: {
        prompt_tokens: 8,
        completion_tokens: 1,
        total_tokens: 9,
      },
    })

    const runtime = new OpenAICompatibleRuntime({
      apiKey: 'test-key',
      model: 'openai/gpt-4o-mini',
      providerType: AIProviderType.OpenRouter,
      providerId: 'openrouter',
    })

    await runtime.generateText({ prompt: 'hello' })

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0]?.[0]).not.toHaveProperty('providerOptions')
  })

  it('adds Vercel gateway automatic caching to structured requests', async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'structured_output',
                  arguments: JSON.stringify({ answer: 'cached' }),
                },
              },
            ],
          },
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
      },
    })

    const runtime = new OpenAICompatibleRuntime({
      apiKey: 'test-key',
      endpoint: 'https://ai-gateway.vercel.sh/v1',
      model: 'anthropic/claude-sonnet-4.6',
      providerType: AIProviderType.OpenAICompatible,
      providerId: 'vercel-gateway',
    })

    await runtime.generateStructured({
      prompt: 'hello',
      schema: z.object({ answer: z.string() }),
    })

    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      providerOptions: {
        gateway: {
          caching: 'auto',
        },
      },
    })
  })

  it('adds Vercel gateway automatic caching to streaming requests', async () => {
    createMock.mockResolvedValueOnce(
      (async function* () {
        yield {
          choices: [{ delta: { content: 'stream' } }],
        }
      })(),
    )

    const runtime = new OpenAICompatibleRuntime({
      apiKey: 'test-key',
      endpoint: 'https://ai-gateway.vercel.sh',
      model: 'anthropic/claude-sonnet-4.6',
      providerType: AIProviderType.OpenAICompatible,
      providerId: 'vercel-gateway',
    })

    const chunks: string[] = []
    for await (const chunk of runtime.generateTextStream({ prompt: 'hello' })) {
      chunks.push(chunk.text)
    }

    expect(chunks).toEqual(['stream'])
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      stream: true,
      providerOptions: {
        gateway: {
          caching: 'auto',
        },
      },
    })
  })
})
