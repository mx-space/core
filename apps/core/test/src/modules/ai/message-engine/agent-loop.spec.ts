import type { AssistantMessage } from '@earendil-works/pi-ai'
import { Type } from 'typebox'
import { describe, expect, it, vi } from 'vitest'

import { Conversation } from '~/modules/ai/message-engine/conversation/conversation'
import { runEngineLoop } from '~/modules/ai/message-engine/loop/agent-loop'
import type { EngineTool } from '~/modules/ai/message-engine/tools/tool.types'

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 },
}

const assistantMsg = (
  content: AssistantMessage['content'],
  stopReason: AssistantMessage['stopReason'],
): AssistantMessage =>
  ({
    role: 'assistant',
    content,
    api: 'openai-completions',
    provider: 'stub',
    model: 'stub',
    usage,
    stopReason,
    timestamp: 1,
  }) as AssistantMessage

const streamOf = (message: AssistantMessage) =>
  ({
    async *[Symbol.asyncIterator]() {
      yield { type: 'done', message }
    },
    result: async () => message,
  }) as any

function stubRuntime(turns: AssistantMessage[]) {
  let call = 0
  const seen: Array<{ messageCount: number }> = []
  return {
    seen,
    runtime: {
      providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamMessage: (opts: { messages: unknown[] }) => {
        seen.push({ messageCount: opts.messages.length })
        const message = turns[Math.min(call++, turns.length - 1)]
        return streamOf(message)
      },
    } as any,
  }
}

const echoTool: EngineTool = {
  name: 'echo',
  description: 'echo',
  parameters: Type.Object(
    { value: Type.String() },
    { additionalProperties: false },
  ),
  execute: async (args) => ({ content: String(args.value) }),
}

describe('runEngineLoop', () => {
  it('executes tool calls, appends results, finishes when model stops', async () => {
    const { runtime, seen } = stubRuntime([
      assistantMsg(
        [
          {
            type: 'toolCall',
            id: 't1',
            name: 'echo',
            arguments: { value: 'hi' },
          },
        ],
        'toolUse',
      ),
      assistantMsg([{ type: 'text', text: 'done' }], 'stop'),
    ])
    const conv = new Conversation('SYS')
    conv.appendUser('go')
    const result = await runEngineLoop({
      runtime,
      conversation: conv,
      tools: [echoTool],
      guards: { maxSteps: 5 },
    })
    expect(result.finishReason).toBe('model-finished')
    expect(result.steps).toBe(2)
    expect(result.toolInvocations).toEqual({ echo: 1 })
    expect(result.totalCostUsd).toBeCloseTo(0.02)
    expect(seen).toEqual([{ messageCount: 1 }, { messageCount: 3 }])
    const roles = conv.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'toolResult', 'assistant'])
  })

  it('rejects invalid tool arguments without executing', async () => {
    const execute = vi.fn()
    const { runtime } = stubRuntime([
      assistantMsg(
        [
          {
            type: 'toolCall',
            id: 't1',
            name: 'echo',
            arguments: { wrong: 'x' },
          },
        ],
        'toolUse',
      ),
      assistantMsg([{ type: 'text', text: 'done' }], 'stop'),
    ])
    const conv = new Conversation('SYS')
    conv.appendUser('go')
    await runEngineLoop({
      runtime,
      conversation: conv,
      tools: [{ ...echoTool, execute }],
      guards: { maxSteps: 5 },
    })
    expect(execute).not.toHaveBeenCalled()
    const toolResult = conv.messages.find((m) => m.role === 'toolResult') as any
    expect(toolResult.isError).toBe(true)
  })

  it('enforces per-tool invocation limits with an error tool result', async () => {
    const { runtime } = stubRuntime([
      assistantMsg(
        [
          {
            type: 'toolCall',
            id: 't1',
            name: 'echo',
            arguments: { value: 'a' },
          },
        ],
        'toolUse',
      ),
      assistantMsg(
        [
          {
            type: 'toolCall',
            id: 't2',
            name: 'echo',
            arguments: { value: 'b' },
          },
        ],
        'toolUse',
      ),
      assistantMsg([{ type: 'text', text: 'done' }], 'stop'),
    ])
    const conv = new Conversation('SYS')
    conv.appendUser('go')
    const result = await runEngineLoop({
      runtime,
      conversation: conv,
      tools: [echoTool],
      guards: { maxSteps: 9, toolInvocationLimits: { echo: 1 } },
    })
    expect(result.toolInvocations).toEqual({ echo: 1 })
    const errResults = conv.messages.filter(
      (m: any) => m.role === 'toolResult' && m.isError,
    ) as any[]
    expect(errResults).toHaveLength(1)
    expect(errResults[0].content[0].text).toContain('budget')
  })

  it('stops at maxSteps', async () => {
    const loopTurn = assistantMsg(
      [{ type: 'toolCall', id: 't1', name: 'echo', arguments: { value: 'x' } }],
      'toolUse',
    )
    const { runtime } = stubRuntime([loopTurn, loopTurn, loopTurn])
    const conv = new Conversation('SYS')
    conv.appendUser('go')
    const result = await runEngineLoop({
      runtime,
      conversation: conv,
      tools: [echoTool],
      guards: { maxSteps: 2 },
    })
    expect(result.finishReason).toBe('max-steps')
    expect(result.steps).toBe(2)
  })

  it('isError tool results surface as error toolResult messages', async () => {
    const failingTool: EngineTool = {
      ...echoTool,
      execute: async () => ({ content: 'tool blew up', isError: true }),
    }
    const { runtime } = stubRuntime([
      assistantMsg(
        [
          {
            type: 'toolCall',
            id: 't1',
            name: 'echo',
            arguments: { value: 'x' },
          },
        ],
        'toolUse',
      ),
      assistantMsg([{ type: 'text', text: 'done' }], 'stop'),
    ])
    const conv = new Conversation('SYS')
    conv.appendUser('go')
    await runEngineLoop({
      runtime,
      conversation: conv,
      tools: [failingTool],
      guards: { maxSteps: 5 },
    })
    const toolResult = conv.messages.find((m) => m.role === 'toolResult') as any
    expect(toolResult.isError).toBe(true)
    expect(toolResult.content[0].text).toContain('tool blew up')
  })

  it('throws on model error stop', async () => {
    const errMsg = {
      ...assistantMsg([], 'error'),
      errorMessage: 'upstream 500',
    } as AssistantMessage
    const { runtime } = stubRuntime([errMsg])
    const conv = new Conversation('SYS')
    conv.appendUser('go')
    await expect(
      runEngineLoop({
        runtime,
        conversation: conv,
        tools: [echoTool],
        guards: { maxSteps: 5 },
      }),
    ).rejects.toThrow('upstream 500')
  })
})
