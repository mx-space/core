import { ChartLine } from 'lucide-react'
import type { IPAggregate } from '~/api/analyze'
import type { AnalyzePeriod, TimeRange } from '../../types/analyze'

import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { buildTrendData } from '../../utils/analyze'
import { AnalyzeSkeleton, EmptyBlock } from '../AnalyzePrimitives'
import { TrendChart } from '../TrendChart'

export function AnalyzeTrendPanel(props: {
  aggregate: IPAggregate | undefined
  isLoading: boolean
  range: TimeRange
}) {
  const { t } = useI18n()
  const period: AnalyzePeriod =
    props.range === 'today' ? 'day' : props.range === '7d' ? 'week' : 'month'
  const trendData = buildTrendData(props.aggregate, period)

  return (
    <Panel
      description={t('analyze.trend.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <ChartLine aria-hidden="true" className="size-4" />
          {t('analyze.trend.title')}
        </span>
      }
    >
      {props.isLoading ? (
        <AnalyzeSkeleton />
      ) : trendData.length ? (
        <TrendChart data={trendData} />
      ) : (
        <EmptyBlock label={t('analyze.trend.empty')} />
      )}
    </Panel>
  )
}
