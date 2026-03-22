import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'

describe('AI_PROMPTS translation emoji preservation', () => {
  it('should instruct markdown translation prompts to preserve emoji exactly', () => {
    const { systemPrompt } = AI_PROMPTS.translation('en', {
      title: '🍞',
      text: '我今天吃了🍞',
      summary: '🍞 summary',
      tags: ['🍞'],
    })

    expect(systemPrompt).toContain('## Emoji Preservation Rules')
    expect(systemPrompt).toContain(
      'NEVER translate, explain, replace, or spell out emoji as words',
    )
    expect(systemPrompt).toContain('Source: 🍞')
    expect(systemPrompt).toContain('Wrong: bread')
    expect(systemPrompt).toContain('Wrong: I ate bread today')
  })

  it('should instruct lexical chunk translation prompts to keep emoji unchanged', () => {
    const { systemPrompt } = AI_PROMPTS.translationChunk('en', {
      documentContext: '早餐记录',
      textEntries: {
        seg1: '🍞',
        seg2: '我今天吃了🍞',
      },
    })

    expect(systemPrompt).toContain(
      'NEVER translate, explain, replace, or spell out emoji as words',
    )
    expect(systemPrompt).toContain(
      'Preserve emoji exactly as written, including order, count, spacing, and position in the sentence',
    )
    expect(systemPrompt).toContain(
      'If a segment contains only emoji, return it exactly unchanged',
    )
  })
})
