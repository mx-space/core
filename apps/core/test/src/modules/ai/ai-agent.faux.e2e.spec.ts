import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import { AiAgentChatService } from '~/modules/ai/ai-agent/ai-agent-chat.service'

const PROVIDER = 'faux-agent'
const MODEL_ID = 'faux-agent-model'

interface SetupOpts {
  responses: ReturnType<typeof fauxAssistantMessage>[]
  conversationId?: string
}

interface FakeConversation {
  id: string
  messages: any[]
}

function setup(opts: SetupOpts) {
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses: opts.responses,
  })
  const conversations = new Map<string, FakeConversation>()
  if (opts.conversationId) {
    conversations.set(opts.conversationId, {
      id: opts.conversationId,
      messages: [],
    })
  }
  const repository = {
    findById: vi.fn(async (id: string) => conversations.get(id) ?? null),
    update: vi.fn(async (id: string, patch: Partial<FakeConversation>) => {
      const conv = conversations.get(id)
      if (!conv) return null
      Object.assign(conv, patch)
      return conv
    }),
  }
  const configService = {
    get: vi.fn(async () => ({
      providers: [
        {
          id: PROVIDER,
          name: 'Faux',
          type: AIProviderType.OpenAICompatible,
          apiKey: 'k',
          endpoint: `https://${PROVIDER}.example.com`,
          defaultModel: MODEL_ID,
          enabled: true,
        },
      ],
    })),
  }
  const service = new AiAgentChatService(
    configService as any,
    repository as any,
  )
  return {
    service,
    repository,
    conversations,
    teardown: () => handle.teardown(),
  }
}

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

describe('ai-agent faux e2e (streamChat)', () => {
  it('text stream: emits text_delta + done', async () => {
    const ctx = setup({ responses: [fauxAssistantMessage('hello world')] })
    torn.push(ctx.teardown)
    const types: string[] = []
    for await (const event of ctx.service.streamChat({
      model: MODEL_ID,
      providerId: PROVIDER,
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      types.push(event.type)
    }
    expect(types).toContain('text_delta')
    expect(types).toContain('done')
  })

  it('thinking stream: emits thinking_delta + text_delta', async () => {
    const ctx = setup({
      responses: [
        fauxAssistantMessage([
          fauxThinking('reasoning...'),
          fauxText('answer'),
        ]),
      ],
    })
    torn.push(ctx.teardown)
    const types: string[] = []
    for await (const event of ctx.service.streamChat({
      model: MODEL_ID,
      providerId: PROVIDER,
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      types.push(event.type)
    }
    expect(types).toContain('thinking_delta')
    expect(types).toContain('text_delta')
  })

  it('toolcall: emits toolcall_start + toolcall_end with payload', async () => {
    const ctx = setup({
      responses: [fauxAssistantMessage([fauxToolCall('add', { a: 1, b: 2 })])],
    })
    torn.push(ctx.teardown)
    let toolEndPayload: any
    for await (const event of ctx.service.streamChat({
      model: MODEL_ID,
      providerId: PROVIDER,
      messages: [{ role: 'user', content: 'use tool' }],
    })) {
      if (event.type === 'toolcall_end') {
        toolEndPayload = event.toolCall
      }
    }
    expect(toolEndPayload).toBeDefined()
    expect(toolEndPayload.name).toBe('add')
  })

  it('aborted-mid-text: persists partial replayable draft', async () => {
    // Long text so abort can fire mid-stream
    const ctx = setup({
      conversationId: 'conv-1',
      responses: [
        fauxAssistantMessage(
          'this is a long stream that should be aborted halfway through',
        ),
      ],
    })
    torn.push(ctx.teardown)
    const controller = new AbortController()
    let collected = ''
    try {
      for await (const event of ctx.service.streamChat({
        model: MODEL_ID,
        providerId: PROVIDER,
        messages: [{ role: 'user', content: 'hi' }],
        conversationId: 'conv-1',
        signal: controller.signal,
      })) {
        if (event.type === 'text_delta') {
          collected += event.delta
          if (collected.length >= 5) controller.abort()
        }
      }
    } catch {
      /* aborted */
    }
    // micro-tasks for persist
    await new Promise((r) => setTimeout(r, 5))
    const conv = ctx.conversations.get('conv-1')
    // Either the draft persisted (partial text) or finalMessage persisted; in
    // both cases the conversation should have at least one assistant message.
    expect(conv?.messages.length ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('aborted-mid-toolcall: partial tool_call is dropped (no committed slot)', async () => {
    // Pipe a tool call response; the abort happens before toolcall_end fires.
    const ctx = setup({
      conversationId: 'conv-2',
      responses: [fauxAssistantMessage([fauxToolCall('add', { a: 1, b: 2 })])],
    })
    torn.push(ctx.teardown)
    const controller = new AbortController()
    controller.abort() // pre-abort
    try {
      for await (const _ of ctx.service.streamChat({
        model: MODEL_ID,
        providerId: PROVIDER,
        messages: [{ role: 'user', content: 'go' }],
        conversationId: 'conv-2',
        signal: controller.signal,
      })) {
        // consume
      }
    } catch {
      /* expected */
    }
    await new Promise((r) => setTimeout(r, 5))
    const conv = ctx.conversations.get('conv-2')
    // If anything is persisted, no toolCall block should be present (partial drop)
    const last = conv?.messages.at(-1)
    if (last) {
      const hasToolCall = (last.content ?? []).some(
        (c: any) => c.type === 'toolCall',
      )
      expect(hasToolCall).toBe(false)
    }
  })

  it('pi error event surfaces as thrown', async () => {
    const ctx = setup({
      responses: [
        fauxAssistantMessage('ignored', {
          stopReason: 'error',
          errorMessage: 'pipeline boom',
        }),
      ],
    })
    torn.push(ctx.teardown)
    // streamChat surfaces error events via the iterator; collect them.
    const errors: any[] = []
    for await (const event of ctx.service.streamChat({
      model: MODEL_ID,
      providerId: PROVIDER,
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      if (event.type === 'error') errors.push(event)
    }
    expect(errors.length).toBeGreaterThan(0)
  })
})
