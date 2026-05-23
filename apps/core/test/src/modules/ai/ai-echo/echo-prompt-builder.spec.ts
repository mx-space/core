import { describe, expect, it } from 'vitest'

import { buildRecentlyEchoPrompt } from '~/modules/ai/ai-echo/echo-prompt-builder'
import type { EchoPromptInput } from '~/modules/ai/ai-echo/scenario.types'
import { PERSONA_REGISTRY } from '~/modules/ai/ai-persona/persona-registry'
import { AI_PERSONA_PROMPTS } from '~/modules/ai/ai-persona/prompts'
import type { RecentlyRow } from '~/modules/recently/recently.types'

const baseSubject = { content: 'hello world' } as RecentlyRow

const baseInput = (
  overrides: Partial<EchoPromptInput<RecentlyRow>> = {},
): EchoPromptInput<RecentlyRow> => ({
  subject: baseSubject,
  persona: PERSONA_REGISTRY['inner-self'],
  profile: null,
  retrieval: [],
  memories: [],
  exemplars: [],
  ...overrides,
})

const NO_MEMORY_RULE = 'Do NOT claim to remember'

describe('buildRecentlyEchoPrompt', () => {
  it('inner-self with no retrieval/memories adds the no-unverified-memory rule', () => {
    const messages = buildRecentlyEchoPrompt(baseInput())
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain(NO_MEMORY_RULE)
    expect(messages[1]).toEqual({ role: 'user', content: 'hello world' })
  })

  it('inner-self with retrieval omits the no-unverified-memory rule', () => {
    const messages = buildRecentlyEchoPrompt(
      baseInput({
        retrieval: [
          {
            sourceType: 'note',
            sourceId: 'n1',
            chunkIndex: 0,
            content: 'past thought',
            distance: 0.1,
            similarity: 0.9,
          },
        ],
      }),
    )
    expect(messages[0].content).not.toContain(NO_MEMORY_RULE)
    expect(messages[0].content).toContain('past thought')
  })

  it('inner-self with memories omits the no-unverified-memory rule', () => {
    const messages = buildRecentlyEchoPrompt(
      baseInput({
        memories: [
          {
            id: 'm1',
            content: 'remembered fact',
          } as any,
        ],
      }),
    )
    expect(messages[0].content).not.toContain(NO_MEMORY_RULE)
    expect(messages[0].content).toContain('remembered fact')
  })

  it('inner-self includes profile summary when present', () => {
    const messages = buildRecentlyEchoPrompt(
      baseInput({
        profile: {
          profileSummary: 'a quiet voice',
          profile: 'long form',
        } as any,
      }),
    )
    expect(messages[0].content).toContain('a quiet voice')
  })

  it('inner-self includes exemplars when present', () => {
    const messages = buildRecentlyEchoPrompt(
      baseInput({
        exemplars: [
          {
            sourceType: 'note',
            sourceId: '1',
            content: 'sample passage',
            createdAt: new Date(),
          },
        ],
      }),
    )
    expect(messages[0].content).toContain('sample passage')
  })

  it('passerby uses the fixed prompt without profile/exemplars/memories/retrieval', () => {
    const messages = buildRecentlyEchoPrompt(
      baseInput({
        persona: PERSONA_REGISTRY['passerby'],
        profile: { profileSummary: 'never used' } as any,
        exemplars: [
          {
            sourceType: 'note',
            sourceId: '1',
            content: 'never used exemplar',
            createdAt: new Date(),
          },
        ],
        memories: [{ id: 'm1', content: 'never used memory' } as any],
        retrieval: [
          {
            sourceType: 'note',
            sourceId: 'n1',
            chunkIndex: 0,
            content: 'never used retrieval',
            distance: 0.1,
            similarity: 0.9,
          },
        ],
      }),
    )
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe(AI_PERSONA_PROMPTS.passerby)
    expect(messages[0].content).not.toContain('never used')
    expect(messages[1]).toEqual({ role: 'user', content: 'hello world' })
  })
})
