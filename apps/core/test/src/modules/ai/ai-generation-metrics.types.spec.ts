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
        cost: { input: 0.01, output: 0.02, cacheRead: 0.001, cacheWrite: 0 },
      }),
    ).toBeCloseTo(0.031)
  })

  it('returns null when no cost', () => {
    expect(resolveCostTotalUsd({})).toBeNull()
    expect(resolveCostTotalUsd({ cost: { total: 0 } })).toBe(0)
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
    expect(merged.cost?.input).toBeNull()
    expect(merged.cost?.output).toBeNull()
  })

  it('keeps an unknown-cost turn unknown when combined with known charges', () => {
    const result = mergeUsage(
      { cost: { total: 0.1 } },
      { inputTokens: 5, cost: null },
    )
    expect(result.cost).toBeNull()
    expect(resolveCostTotalUsd(result)).toBeNull()
    expect(mergeUsage(result, { cost: { total: 0.2 } }).cost).toBeNull()
  })

  it('does not derive a total from an incomplete cost breakdown', () => {
    expect(resolveCostTotalUsd({ cost: { input: 0.01 } })).toBeNull()
  })
})
