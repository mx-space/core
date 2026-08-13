import type { AssistantMessage } from '@earendil-works/pi-ai'
import { describe, expect, it } from 'vitest'

import { Conversation } from '~/modules/ai/message-engine/conversation/conversation'

const assistant = (text: string): AssistantMessage =>
  ({
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: 'openai-completions',
    provider: 'faux',
    model: 'faux',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp: 1,
  }) as AssistantMessage

describe('Conversation', () => {
  it('appends in order and only ever grows', () => {
    const conv = new Conversation('SYS')
    conv.appendUser('u1')
    conv.appendAssistant(assistant('a1'))
    conv.appendToolResult({
      toolCallId: 'tc1',
      toolName: 'review',
      content: '{"issues":[]}',
      isError: false,
    })
    const roles = conv.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'toolResult'])
    expect(conv.systemPrompt).toBe('SYS')
  })

  it('messages getter returns a copy — mutating it does not affect the conversation', () => {
    const conv = new Conversation('SYS')
    conv.appendUser('u1')
    conv.messages.pop()
    expect(conv.messages).toHaveLength(1)
  })
})
