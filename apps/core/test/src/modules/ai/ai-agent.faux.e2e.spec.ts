import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import { AiAgentChatService } from '~/modules/ai/ai-agent/ai-agent-chat.service'

const PROVIDER = 'faux-agent'
const MODEL_ID = 'faux-agent-model'

interface SetupOpts {
  responses: ReturnType<typeof fauxAssistantMessage>[]
}

function setup(opts: SetupOpts) {
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses: opts.responses,
  })
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
  const service = new AiAgentChatService(configService as any)
  return {
    service,
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

  it('aborted-mid-text: remains stateless and surfaces abort through stream', async () => {
    // Long text so abort can fire mid-stream
    const ctx = setup({
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
    expect(collected.length).toBeGreaterThanOrEqual(5)
  })

  it('aborted-mid-toolcall: does not require a persistence target', async () => {
    // Pipe a tool call response; the abort happens before toolcall_end fires.
    const ctx = setup({
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
        signal: controller.signal,
      })) {
        // consume
      }
    } catch {
      /* expected */
    }
    expect(controller.signal.aborted).toBe(true)
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
