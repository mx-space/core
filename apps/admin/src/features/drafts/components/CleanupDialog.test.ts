import { describe, expect, it } from 'vitest'

import { defaultCleanupPicks } from './cleanup-categories'

describe('cleanup dialog defaults', () => {
  it('pre-checks suspected test drafts along with A to D', () => {
    expect([...defaultCleanupPicks()].sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})
