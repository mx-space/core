import type { LucideIcon } from 'lucide-react'
import { Eye, Globe2, Route, Users } from 'lucide-react'

import type { IPAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'

import type { AnalyzePeriod, TimeRange } from '../../types/analyze'
import {
  buildTrendData,
  formatAverageDepth,
  formatNumber,
} from '../../utils/analyze'
import { AnalyzeSkeleton, EmptyBlock } from '../AnalyzePrimitives'
import { TrendChart } from '../TrendChart'

function HeroMetric(props: { icon: LucideIcon; label: string; value: string }) {
  const Icon = props.icon

  return (
    <div className="bg-surface-card px-4 py-3">
      <div className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
        <Icon aria-hidden="true" className="size-3.5 text-fg-subtle" />
        {props.label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-fg">
        {props.value}
      </div>
    </div>
  )
}

export function AnalyzeHeroPanel(props: {
  aggregate: IPAggregate | undefined
  isLoading: boolean
  range: TimeRange
}) {
  const { t } = useI18n()
  const { aggregate } = props
  const period: AnalyzePeriod =
    props.range === 'today' ? 'day' : props.range === '7d' ? 'week' : 'month'
  const trendData = buildTrendData(aggregate, period)

  return (
    <section className="bg-background">
      <div className="grid grid-cols-2 gap-px bg-border-strong xl:grid-cols-4">
        <HeroMetric
          icon={Eye}
          label={t('analyze.metric.pv')}
          value={formatNumber(aggregate?.total.callTime)}
        />
        <HeroMetric
          icon={Users}
          label={t('analyze.metric.uv')}
          value={formatNumber(aggregate?.total.uv)}
        />
        <HeroMetric
          icon={Globe2}
          label={t('analyze.metric.todayIp')}
          value={formatNumber(aggregate?.todayIps.length)}
        />
        <HeroMetric
          icon={Route}
          label={t('analyze.metric.avgDepth')}
          value={formatAverageDepth(
            aggregate?.total.callTime,
            aggregate?.total.uv,
          )}
        />
      </div>
      <div className="border-t border-border">
        {props.isLoading ? (
          <AnalyzeSkeleton />
        ) : trendData.length ? (
          <TrendChart data={trendData} />
        ) : (
          <EmptyBlock label={t('analyze.trend.empty')} />
        )}
      </div>
    </section>
  )
}
