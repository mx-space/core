import { Eye, Globe2, Route, Users } from 'lucide-react'
import type { IPAggregate } from '~/api/analyze'

import { useI18n } from '~/i18n'

import { formatAverageDepth, formatNumber } from '../../utils/analyze'
import { MetricCard } from '../metric-card'

export function AnalyzeMetricsRow(props: {
  aggregate: IPAggregate | undefined
}) {
  const { t } = useI18n()
  const { aggregate } = props

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={Eye}
        label={t('analyze.metric.pv')}
        value={formatNumber(aggregate?.total.callTime)}
      />
      <MetricCard
        icon={Users}
        label={t('analyze.metric.uv')}
        value={formatNumber(aggregate?.total.uv)}
      />
      <MetricCard
        icon={Globe2}
        label={t('analyze.metric.todayIp')}
        value={formatNumber(aggregate?.todayIps.length)}
      />
      <MetricCard
        icon={Route}
        label={t('analyze.metric.avgDepth')}
        value={formatAverageDepth(
          aggregate?.total.callTime,
          aggregate?.total.uv,
        )}
      />
    </div>
  )
}
