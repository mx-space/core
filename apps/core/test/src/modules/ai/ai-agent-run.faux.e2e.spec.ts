import type { Context } from '@earendil-works/pi-ai'
import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai'
import type {
  AgentRunPayload,
  AgentServerEvent,
  AgentToolResultPayload,
} from '@mx-space/ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withFauxAi } from '@/helper/faux-ai.helper'
import { AIProviderType } from '~/modules/ai/ai.types'
import {
  type AgentRunSink,
  type AgentTranscript,
  AiAgentRunService,
} from '~/modules/ai/ai-agent/ai-agent-run.service'
import type { AgentArticleSource } from '~/modules/ai/ai-agent/ai-agent-server-tools'
import { createSteerInbox } from '~/modules/ai/ai-agent/ai-agent-steer'

const PROVIDER = 'faux-agent-run'
const MODEL_ID = 'faux-agent-run-model'

interface StoredConversation {
  id: string
  messages: unknown[]
  transcript: AgentTranscript | null
}

type Step = Parameters<
  ReturnType<typeof withFauxAi>['registration']['setResponses']
>[0][number]

function setup(responses: Step[], conversation?: StoredConversation) {
  const contexts: Context[] = []
  const recorded = responses.map(
    (step) =>
      ((context: Context, ...rest: unknown[]) => {
        contexts.push(structuredClone(context))
        return typeof step === 'function'
          ? (step as any)(context, ...rest)
          : step
      }) as Step,
  )
  const handle = withFauxAi({
    api: 'openai-completions',
    provider: PROVIDER,
    models: [{ id: MODEL_ID, name: MODEL_ID }],
    responses: recorded,
  })
  const conversations = new Map<string, StoredConversation>()
  if (conversation) conversations.set(conversation.id, conversation)
  const repository = {
    findWithTranscript: vi.fn(async (id: string) => {
      const row = conversations.get(id)
      return row
        ? structuredClone({
            messages: row.messages,
            transcript: row.transcript,
          })
        : null
    }),
    saveTranscript: vi.fn(async (id: string, transcript: AgentTranscript) => {
      const row = conversations.get(id)
      if (row) row.transcript = structuredClone(transcript)
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
  const articles: AgentArticleSource = {
    search: vi.fn(async () => [
      {
        type: 'post' as const,
        id: 'p1',
        title: 'Old rust post',
        createdAt: '2024-01-01T00:00:00.000Z',
        snippet: 'rust',
      },
    ]),
    load: vi.fn(async () => null),
  }
  const service = new AiAgentRunService(
    configService as any,
    repository as any,
    articles,
  )
  const events: AgentServerEvent[] = []
  const clientCalls: Array<{ name: string; arguments: unknown }> = []
  let clientReply: (call: {
    toolCallId: string
    name: string
  }) => Promise<Omit<AgentToolResultPayload, 'runId'>> = async (call) => ({
    toolCallId: call.toolCallId,
    content: 'ok',
    isError: false,
  })
  const sink: AgentRunSink = {
    emit: (event) => events.push(event),
    callClientTool: async (call) => {
      clientCalls.push({ name: call.name, arguments: call.arguments })
      return clientReply(call)
    },
  }
  return {
    service,
    sink,
    events,
    contexts,
    clientCalls,
    conversations,
    setClientReply: (fn: typeof clientReply) => {
      clientReply = fn
    },
    teardown: () => handle.teardown(),
  }
}

function payload(overrides: Partial<AgentRunPayload> = {}): AgentRunPayload {
  return {
    runId: 'run-1',
    sessionId: 'post:current',
    conversationId: 'conv-1',
    model: MODEL_ID,
    providerId: PROVIDER,
    system: ['You edit documents.'],
    user: 'hello',
    tools: [
      {
        name: 'bash',
        description: 'Run a command',
        parameters: {
          type: 'object',
          properties: { command: { type: 'string' } },
          required: ['command'],
        },
      },
    ],
    files: [],
    ...overrides,
  }
}

function emptyConversation(): StoredConversation {
  return { id: 'conv-1', messages: [], transcript: null }
}

const torn: Array<() => void> = []
afterEach(() => {
  while (torn.length) torn.pop()!()
})

function turnsOf(context: Context) {
  return context.messages.filter((m) => (m.role as string) !== 'system')
}

function rolesOf(context: Context) {
  return turnsOf(context).map((m) => m.role)
}

function systemOf(context: Context) {
  return context.messages.find(
    (m) => (m.role as string) === 'system',
  ) as unknown as {
    content: string
    toolsAdded: Array<{ name: string }>
  }
}

function userText(context: Context, index: number) {
  const message = turnsOf(context)[index]
  if (message.role !== 'user') return ''
  return typeof message.content === 'string'
    ? message.content
    : message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
}

describe('AiAgentRunService', () => {
  it('streams a text reply and persists the turn', async () => {
    const ctx = setup([fauxAssistantMessage('hi there')], emptyConversation())
    torn.push(ctx.teardown)

    const result = await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory: new Map(),
    })

    expect(result.status).toBe('complete')
    expect(ctx.events.some((e) => e.type === 'text_delta')).toBe(true)
    const transcript = ctx.conversations.get('conv-1')!.transcript!
    expect(transcript.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
    ])
    expect(systemOf(ctx.contexts[0]).content).toBe('You edit documents.')
  })

  it('offers both client and server tools to the model', async () => {
    const ctx = setup([fauxAssistantMessage('ok')], emptyConversation())
    torn.push(ctx.teardown)

    await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory: new Map(),
    })

    expect(
      systemOf(ctx.contexts[0])
        .toolsAdded.map((t) => t.name)
        .sort(),
    ).toEqual(['bash', 'read_article', 'search_articles'])
  })

  it('runs a server tool itself and continues the loop', async () => {
    const ctx = setup(
      [
        fauxAssistantMessage(
          [fauxToolCall('search_articles', { keyword: 'rust' })],
          {
            stopReason: 'toolUse',
          },
        ),
        fauxAssistantMessage('found it'),
      ],
      emptyConversation(),
    )
    torn.push(ctx.teardown)

    const result = await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory: new Map(),
    })

    expect(result.status).toBe('complete')
    expect(ctx.clientCalls).toEqual([])
    const toolResult = ctx.events.find((e) => e.type === 'tool_result')
    expect(toolResult).toMatchObject({
      name: 'search_articles',
      isError: false,
    })
    expect((toolResult as { content: string }).content).toContain('p1')
    const roles = rolesOf(ctx.contexts[1])
    expect(roles).toEqual(['user', 'assistant', 'toolResult'])
  })

  it('sends a client tool to admin and records the files it touched', async () => {
    const ctx = setup(
      [
        fauxAssistantMessage(
          [fauxToolCall('bash', { command: 'cat /doc.xml' })],
          {
            stopReason: 'toolUse',
          },
        ),
        fauxAssistantMessage('read it'),
      ],
      emptyConversation(),
    )
    torn.push(ctx.teardown)
    ctx.setClientReply(async (call) => ({
      toolCallId: call.toolCallId,
      content: '<doc/>',
      isError: false,
      files: [{ path: '/doc.xml', content: '<doc/>' }],
    }))

    const result = await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory: new Map(),
    })

    expect(result.status).toBe('complete')
    expect(ctx.clientCalls).toEqual([
      { name: 'bash', arguments: { command: 'cat /doc.xml' } },
    ])
    expect(ctx.conversations.get('conv-1')!.transcript!.known).toEqual({
      '/doc.xml': '<doc/>',
    })
  })

  it('prepends a diff reminder when a read file changed since the last turn', async () => {
    const conversation = emptyConversation()
    conversation.transcript = {
      messages: [],
      known: { '/doc.xml': '<p id="a">one</p>' },
    }
    const ctx = setup([fauxAssistantMessage('noted')], conversation)
    torn.push(ctx.teardown)

    await ctx.service.run(
      payload({ files: [{ path: '/doc.xml', content: '<p id="a">ONE</p>' }] }),
      {
        sink: ctx.sink,
        signal: new AbortController().signal,
        memory: new Map(),
      },
    )

    const text = userText(ctx.contexts[0], 0)
    expect(text).toContain('<system-reminder>')
    expect(text).toContain('+<p id="a">ONE</p>')
    expect(text.trimEnd().endsWith('hello')).toBe(true)
    expect(ctx.events).toContainEqual({ type: 'reminder', paths: ['/doc.xml'] })
  })

  it('seeds history from stored chat bubbles when no transcript exists', async () => {
    const conversation = emptyConversation()
    conversation.messages = [
      { type: 'user', content: 'earlier question' },
      { type: 'assistant', content: 'earlier answer' },
      { type: '__agent_review_state__', reviewState: {} },
    ]
    const ctx = setup([fauxAssistantMessage('ok')], conversation)
    torn.push(ctx.teardown)

    await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory: new Map(),
    })

    expect(rolesOf(ctx.contexts[0])).toEqual(['user', 'assistant', 'user'])
    expect(userText(ctx.contexts[0], 0)).toBe('earlier question')
  })

  it('does not repeat the current message when the stored bubbles already hold it', async () => {
    const conversation = emptyConversation()
    conversation.messages = [{ type: 'user', content: 'hello' }]
    const ctx = setup([fauxAssistantMessage('ok')], conversation)
    torn.push(ctx.teardown)

    await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory: new Map(),
    })

    expect(rolesOf(ctx.contexts[0])).toEqual(['user'])
  })

  it('keeps an unsaved conversation in the connection memory', async () => {
    const ctx = setup([
      fauxAssistantMessage('one'),
      fauxAssistantMessage('two'),
    ])
    torn.push(ctx.teardown)
    const memory = new Map<string, AgentTranscript>()
    const options = {
      sink: ctx.sink,
      signal: new AbortController().signal,
      memory,
    }

    await ctx.service.run(payload({ conversationId: null }), options)
    await ctx.service.run(
      payload({ conversationId: null, runId: 'run-2', user: 'again' }),
      options,
    )

    expect(rolesOf(ctx.contexts[1])).toEqual(['user', 'assistant', 'user'])
  })

  it('aborts while waiting for a client tool and leaves a replayable transcript', async () => {
    const ctx = setup(
      [
        fauxAssistantMessage([fauxToolCall('bash', { command: 'ls' })], {
          stopReason: 'toolUse',
        }),
      ],
      emptyConversation(),
    )
    torn.push(ctx.teardown)
    const controller = new AbortController()
    ctx.setClientReply(async () => {
      controller.abort()
      throw new Error('aborted')
    })

    const result = await ctx.service.run(payload(), {
      sink: ctx.sink,
      signal: controller.signal,
      memory: new Map(),
    })

    expect(result.status).toBe('aborted')
    const messages = ctx.conversations.get('conv-1')!.transcript!.messages
    expect(messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'toolResult',
    ])
    expect(messages[2]).toMatchObject({ isError: true })
  })

  describe('steer', () => {
    it('injects a steer after the tool results, before the next model call', async () => {
      const conversation = emptyConversation()
      conversation.transcript = {
        messages: [],
        known: { '/doc.xml': '<p id="a">one</p>' },
      }
      const ctx = setup(
        [
          fauxAssistantMessage([fauxToolCall('bash', { command: 'ls' })], {
            stopReason: 'toolUse',
          }),
          fauxAssistantMessage('adjusted'),
        ],
        conversation,
      )
      torn.push(ctx.teardown)
      const inbox = createSteerInbox()
      ctx.setClientReply(async (call) => {
        inbox.push({
          user: 'use a shorter title',
          files: [{ path: '/doc.xml', content: '<p id="a">ONE</p>' }],
        })
        return { toolCallId: call.toolCallId, content: 'ok', isError: false }
      })

      const result = await ctx.service.run(payload(), {
        sink: ctx.sink,
        signal: new AbortController().signal,
        memory: new Map(),
        inbox,
      })

      expect(result.status).toBe('complete')
      expect(rolesOf(ctx.contexts[1])).toEqual([
        'user',
        'assistant',
        'toolResult',
        'user',
      ])
      const steered = userText(ctx.contexts[1], 3)
      expect(steered).toContain('+<p id="a">ONE</p>')
      expect(steered.trimEnd().endsWith('use a shorter title')).toBe(true)
    })

    it('keeps going when a steer arrives while the model is finishing', async () => {
      const inbox = createSteerInbox()
      const ctx = setup(
        [
          () => {
            inbox.push({ user: 'and add a summary', files: [] })
            return fauxAssistantMessage('first answer')
          },
          fauxAssistantMessage('with summary'),
        ],
        emptyConversation(),
      )
      torn.push(ctx.teardown)

      const result = await ctx.service.run(payload(), {
        sink: ctx.sink,
        signal: new AbortController().signal,
        memory: new Map(),
        inbox,
      })

      expect(result.status).toBe('complete')
      expect(ctx.contexts).toHaveLength(2)
      expect(rolesOf(ctx.contexts[1])).toEqual(['user', 'assistant', 'user'])
      expect(userText(ctx.contexts[1], 2)).toBe('and add a summary')
    })

    it('closes the inbox once the turn completes', async () => {
      const ctx = setup([fauxAssistantMessage('done')], emptyConversation())
      torn.push(ctx.teardown)
      const inbox = createSteerInbox()

      await ctx.service.run(payload(), {
        sink: ctx.sink,
        signal: new AbortController().signal,
        memory: new Map(),
        inbox,
      })

      expect(inbox.push({ user: 'too late', files: [] })).toBe(false)
    })

    it('keeps a steer that arrived before an abort in the transcript', async () => {
      const ctx = setup(
        [
          fauxAssistantMessage([fauxToolCall('bash', { command: 'ls' })], {
            stopReason: 'toolUse',
          }),
        ],
        emptyConversation(),
      )
      torn.push(ctx.teardown)
      const controller = new AbortController()
      const inbox = createSteerInbox()
      ctx.setClientReply(async () => {
        inbox.push({ user: 'never mind', files: [] })
        controller.abort()
        throw new Error('aborted')
      })

      const result = await ctx.service.run(payload(), {
        sink: ctx.sink,
        signal: controller.signal,
        memory: new Map(),
        inbox,
      })

      expect(result.status).toBe('aborted')
      const messages = ctx.conversations.get('conv-1')!.transcript!.messages
      expect(messages.map((m) => m.role)).toEqual([
        'user',
        'assistant',
        'toolResult',
        'user',
      ])
      expect(messages[3]).toMatchObject({ content: 'never mind' })
      expect(inbox.push({ user: 'again', files: [] })).toBe(false)
    })
  })
})
