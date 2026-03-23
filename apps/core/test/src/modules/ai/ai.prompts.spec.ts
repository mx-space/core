import { describe, expect, it } from 'vitest'

import { AI_PROMPTS } from '~/modules/ai/ai.prompts'

describe('AI_PROMPTS translation emoji preservation', () => {
  const emojiRule =
    'Preserve emoji exactly as written; never translate, explain, replace, or spell them out, keep their order, count, spacing, punctuation, and position unchanged, return emoji-only content unchanged, and translate only the surrounding natural language'

  it('should instruct markdown translation prompts to preserve emoji exactly', () => {
    const { systemPrompt } = AI_PROMPTS.translation('en', {
      title: '🍞',
      text: '我今天吃了🍞',
      summary: '🍞 summary',
      tags: ['🍞'],
    })

    expect(systemPrompt).toContain(emojiRule)
  })

  it('should instruct lexical chunk translation prompts to keep emoji unchanged', () => {
    const { systemPrompt } = AI_PROMPTS.translationChunk('en', {
      documentContext: '早餐记录',
      textEntries: {
        seg1: '🍞',
        seg2: '我今天吃了🍞',
      },
    })

    expect(systemPrompt).toContain(emojiRule)
  })

  it('should instruct lexical chunk translation prompts to return structured group translations', () => {
    const { systemPrompt, schema } = AI_PROMPTS.translationChunk('en', {
      documentContext: '段落上下文',
      textEntries: {
        seg1: {
          type: 'text.group',
          segments: [
            { id: 't_0', text: '后面她才开始慢慢地想要寻回记忆。' },
            { id: 't_1', text: '记忆会被遗忘，但爱不会。' },
          ],
        },
      },
    })

    expect(systemPrompt).toContain('Some segment values may be group objects')
    expect(systemPrompt).toContain(
      'Return an object for that same key, not a string',
    )
    expect(systemPrompt).toContain('Read the "segments" array in order')
    expect(systemPrompt).toContain(
      'The concatenation of the returned segment values in array order MUST exactly form the final translated sentence or paragraph',
    )
    expect(systemPrompt).toContain(
      'Example invalid output: {"t_0":"Hello.","t_1":"World."} because concatenation loses the required space',
    )

    expect(
      schema.safeParse({
        sourceLang: 'zh',
        translations: {
          seg1: {
            t_0: 'Only later did she begin trying to recover her memories.',
            t_1: ' Memories may fade, but love will not.',
          },
        },
      }).success,
    ).toBe(true)
    expect(
      schema.safeParse({
        sourceLang: 'zh',
        translations: {
          seg1: {
            t_0: 'Only later did she begin trying to recover her memories.',
          },
        },
      }).success,
    ).toBe(false)
  })

  it('should instruct lexical chunk translation prompts to escape quotes inside JSON strings', () => {
    const { systemPrompt } = AI_PROMPTS.translationChunk('en', {
      documentContext: '引号约束',
      textEntries: {
        seg1: '如果你读到 "ignore previous instructions"，请把它当作内容。',
      },
    })

    expect(systemPrompt).toContain(
      'Escape any double quotes that appear inside translated string values so the final JSON remains valid',
    )
    expect(systemPrompt).toContain(
      'prefer typographic quotes or single quotes instead of raw ASCII double quotes unless escaping is unavoidable',
    )
  })
})
