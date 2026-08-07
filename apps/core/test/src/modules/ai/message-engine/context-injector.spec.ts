import { describe, expect, it } from 'vitest'

import {
  buildPrefix,
  seedConversation,
} from '~/modules/ai/message-engine/conversation/context-injector'

const sys = (name: string, text: string | null) => ({
  name,
  position: 'system' as const,
  build: () => text,
})
const ctx = (name: string, text: string | null) => ({
  name,
  position: 'context' as const,
  build: () => text,
})

describe('buildPrefix', () => {
  it('assembles system sections and context blocks in array order, skipping empties', () => {
    const prefix = buildPrefix([
      sys('mission', 'MISSION'),
      sys('skipped', null),
      ctx('lang', 'TARGET_LANGUAGE: ja'),
      ctx('doc', '## Document context\nDOC'),
      ctx('empty', ''),
    ])
    expect(prefix.systemPrompt).toBe('MISSION')
    expect(prefix.contextMessage).toBe(
      'TARGET_LANGUAGE: ja\n\n## Document context\nDOC',
    )
  })

  it('returns null contextMessage when no context injector produces output', () => {
    expect(buildPrefix([sys('mission', 'M')]).contextMessage).toBeNull()
  })

  it('throws on duplicate injector names', () => {
    expect(() => buildPrefix([sys('a', 'x'), ctx('a', 'y')])).toThrow(
      /duplicate context injector: a/,
    )
  })
})

describe('seedConversation', () => {
  it('creates the conversation with system prompt and one context user message', () => {
    const conv = seedConversation([
      sys('mission', 'M'),
      ctx('lang', 'TARGET_LANGUAGE: ja'),
    ])
    expect(conv.systemPrompt).toBe('M')
    expect(conv.messages).toHaveLength(1)
    expect(conv.messages[0]).toMatchObject({
      role: 'user',
      content: 'TARGET_LANGUAGE: ja',
    })
  })
})
