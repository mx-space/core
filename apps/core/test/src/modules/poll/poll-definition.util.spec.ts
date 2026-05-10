import { describe, expect, it } from 'vitest'

import { ContentFormat } from '~/shared/types/content-format.type'
import { extractPollDefinitions, isPollClosed } from '~/modules/poll/poll-definition.util'

describe('poll definition extraction', () => {
  it('extracts poll metadata from lexical content', () => {
    const definitions = extractPollDefinitions({
      contentFormat: ContentFormat.Lexical,
      text: null,
      content: JSON.stringify({
        root: {
          children: [
            {
              type: 'poll',
              pollId: 'p_vote',
              question: 'Choose one',
              mode: 'single',
              closeAt: '2999-01-01T00:00:00.000Z',
              showResults: 'after-vote',
              options: [
                { id: 'o_a', label: 'A' },
                { id: 'o_b', label: 'B' },
              ],
            },
          ],
        },
      }),
    })

    expect(definitions).toEqual([
      {
        pollId: 'p_vote',
        question: 'Choose one',
        mode: 'single',
        closeAt: '2999-01-01T00:00:00.000Z',
        showResults: 'after-vote',
        options: [
          { id: 'o_a', label: 'A' },
          { id: 'o_b', label: 'B' },
        ],
      },
    ])
  })

  it('extracts poll metadata from markdown export blocks', () => {
    const definitions = extractPollDefinitions({
      contentFormat: ContentFormat.Markdown,
      content: `<!--haklex:poll {"pollId":"p_abc","mode":"multiple","closeAt":"2999-01-01T00:00:00.000Z"}-->
**Choose**

- A <!-- id=o_a -->
- B <!-- id=o_b -->
<!--/haklex:poll-->`,
    })

    expect(definitions).toEqual([
      {
        pollId: 'p_abc',
        question: 'Choose',
        mode: 'multiple',
        closeAt: '2999-01-01T00:00:00.000Z',
        options: [
          { id: 'o_a', label: 'A' },
          { id: 'o_b', label: 'B' },
        ],
      },
    ])
  })

  it('treats elapsed closeAt as closed', () => {
    expect(isPollClosed({ closeAt: '2000-01-01T00:00:00.000Z' })).toBe(true)
    expect(isPollClosed({ closeAt: '2999-01-01T00:00:00.000Z' })).toBe(false)
    expect(isPollClosed({ closeAt: 'not-a-date' })).toBe(false)
  })
})
