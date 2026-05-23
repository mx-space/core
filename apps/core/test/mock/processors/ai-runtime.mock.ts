import type { GenerateTextOptions } from '~/modules/ai/runtime/types'

export type MockChatBehavior =
  | { kind: 'text'; text: string }
  | { kind: 'throw'; error: Error }
  | {
      kind: 'fn'
      fn: (options: GenerateTextOptions) => string | Promise<string>
    }

export interface MockAiRuntimeOptions {
  modelId?: string
  providerId?: string
  behavior?: MockChatBehavior
}

export function createMockAiRuntime(options: MockAiRuntimeOptions = {}) {
  let nextBehavior: MockChatBehavior = options.behavior ?? {
    kind: 'text',
    text: 'mock-response',
  }
  const calls: GenerateTextOptions[] = []

  const runtime = {
    providerInfo: {
      id: options.providerId ?? 'mock-provider',
      type: 'openai-compatible' as const,
      model: options.modelId ?? 'mock-model',
    },
    async generateText(opts: GenerateTextOptions) {
      calls.push(opts)
      const b = nextBehavior
      if (b.kind === 'throw') throw b.error
      const text = b.kind === 'fn' ? await b.fn(opts) : b.text
      return { text }
    },
    async generateStructured() {
      throw new Error('mock chat runtime does not support generateStructured')
    },
  }

  return {
    runtime,
    calls,
    setBehavior(behavior: MockChatBehavior) {
      nextBehavior = behavior
    },
    reset() {
      nextBehavior = options.behavior ?? { kind: 'text', text: 'mock-response' }
      calls.length = 0
    },
  }
}
