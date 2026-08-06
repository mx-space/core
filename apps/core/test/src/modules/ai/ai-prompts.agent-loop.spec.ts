import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'

describe('AI_PROMPTS.translationAgent', () => {
  it('appends the agent-loop contract after the chunk system', () => {
    const { systemPrompt } = AI_PROMPTS.translationAgent('ja', {
      reviewEnabled: true,
    })
    expect(systemPrompt).toContain('## Agent mode')
    expect(systemPrompt).toContain('request_review')
    expect(systemPrompt).toContain('patch_translation')
    expect(systemPrompt.indexOf('## Agent mode')).toBeGreaterThan(0)
  })

  it('keeps the per-language partial (ja ruby present)', () => {
    const { systemPrompt } = AI_PROMPTS.translationAgent('ja', {
      reviewEnabled: true,
    })
    expect(systemPrompt).toContain('ruby')
  })

  it('reviewEnabled=false drops the review obligation', () => {
    const { systemPrompt } = AI_PROMPTS.translationAgent('en', {
      reviewEnabled: false,
    })
    expect(systemPrompt).not.toContain('request_review')
    expect(systemPrompt).toContain('finish by responding')
  })

  it('marker comments never leak into either variant', () => {
    for (const reviewEnabled of [true, false]) {
      const { systemPrompt } = AI_PROMPTS.translationAgent('en', {
        reviewEnabled,
      })
      expect(systemPrompt).not.toContain('REVIEW-OBLIGATION-START')
      expect(systemPrompt).not.toContain('NO-REVIEW-START')
    }
  })
})
