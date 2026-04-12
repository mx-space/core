import { describe, expect, it } from 'vitest'

import { RecentlyModel } from '~/modules/recently/recently.model'

describe('RecentlyModel refId', () => {
  it('prefers canonical id from normalized populated refs', () => {
    const model = new RecentlyModel()
    ;(model as any).ref = { id: 'post-1', title: 'Post' }

    expect(model.refId).toBe('post-1')
  })

  it('falls back to legacy _id for unnormalized populated refs', () => {
    const model = new RecentlyModel()
    ;(model as any).ref = { _id: 'post-2', title: 'Post' }

    expect(model.refId).toBe('post-2')
  })

  it('returns raw ref when relation is not populated', () => {
    const model = new RecentlyModel()
    ;(model as any).ref = 'post-3'

    expect(model.refId).toBe('post-3')
  })
})
