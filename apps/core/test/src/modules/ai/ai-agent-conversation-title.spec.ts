import { describe, expect, it } from 'vitest'

import { firstExchangeOf } from '~/modules/ai/ai-agent/ai-agent-conversation.service'

describe('firstExchangeOf', () => {
  it('takes the first user text without its system reminder and the first assistant text', () => {
    expect(
      firstExchangeOf([
        {
          role: 'user',
          content:
            '<system-reminder>\n/selection.xml (attached by the user):\n<p>x</p>\n</system-reminder>\n\nRewrite the intro',
          timestamp: 1,
        },
        {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'text', text: 'Here is a new intro.' },
          ],
          timestamp: 2,
        } as any,
      ]),
    ).toEqual({ user: 'Rewrite the intro', assistant: 'Here is a new intro.' })
  })

  it('returns null before the assistant has replied', () => {
    expect(
      firstExchangeOf([{ role: 'user', content: 'hi', timestamp: 1 }]),
    ).toBeNull()
  })
})
