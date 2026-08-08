import { describe, expect, it } from 'vitest'

import {
  mergeUsage,
  resolveCostTotalUsd,
  resolveTotalTokens,
} from '~/modules/ai/ai-generation-metrics/ai-generation-metrics.types'

describe('ai-generation-metrics.types', () => {
  it('prefers provider cost.total when positive', () => {
    expect(
      resolveCostTotalUsd({
        cost: { input: 0.01, output: 0.02, total: 0.05 },
      }),
    ).toBe(0.05)
  })

  it('sums cost parts when total missing', () => {
    expect(
      resolveCostTotalUsd({
        cost: { input: 0.01, output: 0.02, cacheRead: 0.001 },
      }),
    ).toBeCloseTo(0.031)
  })

  it('returns null when no cost', () => {
    expect(resolveCostTotalUsd({})).toBeNull()
    expect(resolveCostTotalUsd({ cost: { total: 0 } })).toBeNull()
  })

  it('sums tokens when total missing', () => {
    expect(
      resolveTotalTokens({
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 2,
      }),
    ).toBe(17)
  })

  it('merges usage additively', () => {
    const merged = mergeUsage(
      {
        inputTokens: 1,
        outputTokens: 2,
        cost: { total: 0.1, input: 0.04 },
      },
      {
        inputTokens: 3,
        cacheReadTokens: 4,
        cost: { total: 0.2, output: 0.05 },
      },
    )
    expect(merged.inputTokens).toBe(4)
    expect(merged.outputTokens).toBe(2)
    expect(merged.cacheReadTokens).toBe(4)
    expect(merged.cost?.total).toBeCloseTo(0.3)
    expect(merged.cost?.input).toBeCloseTo(0.04)
    expect(merged.cost?.output).toBeCloseTo(0.05)
  })
})
