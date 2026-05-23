import { describe, expect, it, vi } from 'vitest'

import { PersonaDistillProcessor } from '~/modules/ai/ai-persona/tasks/persona-distill.processor'

const makeProcessor = () => {
  const db = {} as any
  const taskProcessor = { registerHandler: vi.fn() } as any
  const aiService = {} as any
  const configsService = {} as any
  const profileRepo = {} as any
  const redisService = {} as any
  const eventManager = {} as any
  return new PersonaDistillProcessor(
    db,
    taskProcessor,
    aiService,
    configsService,
    profileRepo,
    redisService,
    eventManager,
  )
}

describe('PersonaDistillProcessor.parseDistillOutput', () => {
  const processor = makeProcessor()

  it('parses a well-formed JSON envelope', () => {
    const raw = JSON.stringify({
      profile: 'The author writes with quiet precision.',
      profile_summary: 'Quiet, precise voice.',
      metadata: {
        tone_tags: ['quiet', 'precise'],
        recurring_themes: ['solitude'],
        signature_phrases: ['it is what it is'],
      },
    })
    const parsed = processor.parseDistillOutput(raw)
    expect(parsed.profile).toContain('quiet precision')
    expect(parsed.profileSummary).toBe('Quiet, precise voice.')
    expect(parsed.metadata.toneTags).toEqual(['quiet', 'precise'])
    expect(parsed.metadata.recurringThemes).toEqual(['solitude'])
    expect(parsed.metadata.signaturePhrases).toEqual(['it is what it is'])
  })

  it('strips markdown fences before parsing', () => {
    const raw =
      '```json\n' +
      JSON.stringify({
        profile: 'hello',
        profile_summary: null,
        metadata: {},
      }) +
      '\n```'
    const parsed = processor.parseDistillOutput(raw)
    expect(parsed.profile).toBe('hello')
    expect(parsed.profileSummary).toBeNull()
  })

  it('falls back to text-only profile on malformed JSON', () => {
    const raw = 'This is not JSON at all; just prose about voice.'
    const parsed = processor.parseDistillOutput(raw)
    expect(parsed.profile).toBe(raw)
    expect(parsed.profileSummary).toBeNull()
    expect(parsed.metadata.toneTags).toEqual([])
  })

  it('throws on empty input', () => {
    expect(() => processor.parseDistillOutput('')).toThrow(
      'Empty distill output',
    )
    expect(() => processor.parseDistillOutput('   \n  ')).toThrow(
      'Empty distill output',
    )
  })

  it('falls back when JSON shape is invalid', () => {
    const raw = JSON.stringify({ profile: 123, metadata: 'oops' })
    const parsed = processor.parseDistillOutput(raw)
    expect(parsed.profile.length).toBeGreaterThan(0)
    expect(parsed.profileSummary).toBeNull()
  })
})

describe('PersonaDistillProcessor.buildDistillPrompt', () => {
  const processor = makeProcessor()

  it('emits system + user with passage headers and JSON instruction', () => {
    const messages = processor.buildDistillPrompt([
      {
        sourceType: 'post',
        sourceId: '1',
        title: 'First Post',
        createdAt: new Date('2025-01-15T00:00:00Z'),
        body: 'lorem ipsum',
      },
      {
        sourceType: 'note',
        sourceId: '2',
        title: null,
        createdAt: new Date('2025-02-20T00:00:00Z'),
        body: 'dolor sit amet',
      },
    ])
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('raw JSON')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toContain('[post:1 — 2025-01-15 — First Post]')
    expect(messages[1].content).toContain('[note:2 — 2025-02-20]')
    expect(messages[1].content).toContain('lorem ipsum')
    expect(messages[1].content).toContain('dolor sit amet')
  })
})
