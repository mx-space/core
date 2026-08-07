import { describe, expect, it } from 'vitest'

import { buildTtsRegeneratePayload } from './ai'

describe('buildTtsRegeneratePayload', () => {
  it('forces regeneration and scopes the task to the row language', () => {
    expect(buildTtsRegeneratePayload({ lang: 'zh', refId: '42' })).toEqual({
      force: true,
      langs: ['zh'],
      refId: '42',
    })
  })

  it('always sets force, so an unchanged article still re-synthesizes', () => {
    // Without this the management page's regenerate action is a no-op by
    // construction: every row it can act on already has narration.
    expect(buildTtsRegeneratePayload({ lang: 'en', refId: '7' }).force).toBe(
      true,
    )
  })
})
