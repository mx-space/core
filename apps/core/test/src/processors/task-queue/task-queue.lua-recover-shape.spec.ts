import { describe, expect, it } from 'vitest'

import { parseRecoverStaleResult } from '~/processors/task-queue/task-queue.service'

describe('parseRecoverStaleResult — LUA_RECOVER_STALE dual-shape handler', () => {
  it('parses an empty recovery batch ({ 0 }) as count=0 ids=[]', () => {
    expect(parseRecoverStaleResult([0])).toEqual({ count: 0, ids: [] })
  })

  it('parses a populated batch ({ 2, "id1", "id2" }) as count + ids', () => {
    expect(parseRecoverStaleResult([2, 'id1', 'id2'])).toEqual({
      count: 2,
      ids: ['id1', 'id2'],
    })
  })

  it('treats non-array (defensive) as empty result', () => {
    expect(parseRecoverStaleResult(null)).toEqual({ count: 0, ids: [] })
    expect(parseRecoverStaleResult(undefined)).toEqual({ count: 0, ids: [] })
    expect(parseRecoverStaleResult(0)).toEqual({ count: 0, ids: [] })
  })

  it('coerces numeric ids to strings', () => {
    expect(parseRecoverStaleResult([1, 42])).toEqual({
      count: 1,
      ids: ['42'],
    })
  })
})
