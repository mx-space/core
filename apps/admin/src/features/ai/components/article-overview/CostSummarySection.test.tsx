import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'

import type { GenerationMetrics } from '~/api/ai'
import type { AiOverviewDetail } from '~/api/ai-overview'
import { UI_LOCALE_STORAGE_KEY } from '~/constants/keys'
import { I18nProvider } from '~/i18n'

import { GenerationMetricsMeta } from '../article-grouped/GenerationMetricsMeta'
import { CostSummarySection } from './CostSummarySection'

vi.unmock('~/i18n')

function text(element: React.ReactNode) {
  localStorage.setItem(UI_LOCALE_STORAGE_KEY, 'zh-CN')
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => root.render(<I18nProvider>{element}</I18nProvider>))
  const content = container.textContent || ''
  act(() => root.unmount())
  return content
}
function cost(
  unknownCostCount: number,
  costTotalUsd: number,
): AiOverviewDetail['cost'] {
  return {
    models: [],
    byResourceType: {} as AiOverviewDetail['cost']['byResourceType'],
    total: {
      inputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 12,
      generationCount: 3,
      unknownCostCount,
      costTotalUsd,
    },
  }
}
it('labels a known subtotal when some generations did not report cost', () => {
  const content = text(<CostSummarySection cost={cost(1, 0.02)} />)
  expect(content).toContain('$0.0200（已知部分）')
  expect(content).toContain('1 次生成未返回费用')
})
it('shows unknown instead of zero when no generation reports a cost', () => {
  const content = text(<CostSummarySection cost={cost(3, 0)} />)
  expect(content).toContain('未知')
  expect(content).not.toContain('$0.0000')
})
it('preserves an explicitly reported free total', () => {
  expect(text(<CostSummarySection cost={cost(0, 0)} />)).toContain('$0.0000')
})
it('shows unknown cost in per-generation metadata', () => {
  expect(
    text(
      <GenerationMetricsMeta
        metrics={{ totalTokens: 12, costTotalUsd: null } as GenerationMetrics}
      />,
    ),
  ).toContain('未知')
})
