import { describe, expect, it } from 'vitest'

import { addAgentUsage, describeAgentUsage } from './agent-usage'

describe('addAgentUsage', () => {
  it('sums each model call and counts the calls', () => {
    const first = addAgentUsage(undefined, {
      cacheRead: 9000,
      cacheWrite: 0,
      cost: { total: 0.002 },
      input: 1000,
      output: 300,
    })
    const total = addAgentUsage(first, {
      cacheRead: 702,
      cacheWrite: 0,
      cost: { total: 0.0011 },
      input: 1729,
      output: 560,
    })

    expect(total).toEqual({
      cacheRead: 9702,
      cacheWrite: 0,
      calls: 2,
      cost: 0.0031,
      input: 2729,
      output: 860,
    })
  })

  it('ignores a message without usage', () => {
    expect(addAgentUsage(undefined, undefined)).toBeUndefined()
  })
})

describe('describeAgentUsage', () => {
  it('counts cached tokens as part of the prompt and derives the hit rate', () => {
    expect(
      describeAgentUsage({
        cacheRead: 9702,
        cacheWrite: 0,
        calls: 4,
        cost: 0.0031,
        input: 2729,
        output: 860,
      }),
    ).toEqual({
      cost: '$0.0031',
      hitRate: '78%',
      input: '12.4k',
      output: '860',
    })
  })

  it('leaves out the hit rate and price when there is nothing to show', () => {
    expect(
      describeAgentUsage({
        cacheRead: 0,
        cacheWrite: 0,
        calls: 1,
        cost: 0,
        input: 0,
        output: 12,
      }),
    ).toEqual({ cost: null, hitRate: null, input: '0', output: '12' })
  })

  it('prints larger prices with cents precision', () => {
    expect(
      describeAgentUsage({
        cacheRead: 0,
        cacheWrite: 0,
        calls: 1,
        cost: 1.23456,
        input: 1_250_000,
        output: 1000,
      }),
    ).toMatchObject({ cost: '$1.23', input: '1.25M', output: '1k' })
  })
})
