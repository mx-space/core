import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'

const hints =
  'DOCUMENT_TYPE: personal technical blog\nREGISTER: candid, conversational'

describe('AI_PROMPTS translation style hints', () => {
  it('injects style context into chunk prompt only when provided', () => {
    const withHints = AI_PROMPTS.translationChunk('ja', {
      documentContext: 'ctx',
      textEntries: { t_0: 'hello' },
      styleHints: hints,
    })
    expect(withHints.prompt).toContain('## Style context')
    expect(withHints.prompt).toContain(hints)

    const without = AI_PROMPTS.translationChunk('ja', {
      documentContext: 'ctx',
      textEntries: { t_0: 'hello' },
    })
    expect(without.prompt).not.toContain('## Style context')
  })

  it('injects style context into stream prompt', () => {
    const stream = AI_PROMPTS.translationStream('ja', {
      title: 't',
      text: 'body',
      styleHints: hints,
    })
    expect(stream.prompt).toContain('STYLE_CONTEXT')
    expect(stream.prompt).toContain(hints)

    const without = AI_PROMPTS.translationStream('ja', {
      title: 't',
      text: 'body',
    })
    expect(without.prompt).not.toContain('STYLE_CONTEXT')
  })

  it('pins the fixed reviewer issue budget in the prompt', () => {
    const reviewer = AI_PROMPTS.translationReviewer('ja', {
      allowedIds: ['a'],
      segments: { a: { target: 'x' } },
    })
    expect(reviewer.prompt).toContain('MAX_ISSUES: 12')
  })

  it('injects style context into reviewer and editor prompts', () => {
    const reviewer = AI_PROMPTS.translationReviewer('ja', {
      allowedIds: ['a'],
      segments: { a: { source: 'x', target: 'b' } },
      styleHints: hints,
    })
    expect(reviewer.prompt).toContain('## Style guide')
    expect(reviewer.prompt).toContain(hints)

    const editor = AI_PROMPTS.translationEditor('ja', {
      fullTranslations: { a: 'b' },
      issues: [],
      styleHints: hints,
    })
    expect(editor.prompt).toContain('## Style context')
    expect(editor.prompt).toContain(hints)
  })
})
