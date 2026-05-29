import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { TimeRange } from '../types/analyze'

import { getAnalyzeAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Scroll } from '~/ui/primitives/scroll'

import { analyzeQueryKey } from '../constants'
import { getTimeWindow } from '../utils/analyze'
import { AnalyzeActions } from './blocks/AnalyzeActions'
import { AnalyzeActivityPanel } from './blocks/AnalyzeActivityPanel'
import { AnalyzeCompositionRow } from './blocks/AnalyzeCompositionRow'
import { AnalyzeContentRow } from './blocks/AnalyzeContentRow'
import { AnalyzeMetricsRow } from './blocks/AnalyzeMetricsRow'
import { AnalyzeRecordsCollapsible } from './blocks/AnalyzeRecordsCollapsible'
import { AnalyzeTrendPanel } from './blocks/AnalyzeTrendPanel'

export function AnalyzeRouteViewContent() {
  const { t } = useI18n()
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const timeWindow = useMemo(() => getTimeWindow(timeRange), [timeRange])

  const aggregateQuery = useQuery({
    queryFn: getAnalyzeAggregate,
    queryKey: [...analyzeQueryKey, 'aggregate'],
  })

  const aggregate = aggregateQuery.data

  return (
    <AppPage>
      <PageHeader
        actions={
          <AnalyzeActions range={timeRange} onRangeChange={setTimeRange} />
        }
        description={t('analyze.page.description')}
        title={t('analyze.page.title')}
      />

      <Scroll className="min-h-0 flex-1" innerClassName="space-y-4 p-4">
        <AnalyzeMetricsRow aggregate={aggregate} />
        <AnalyzeTrendPanel
          aggregate={aggregate}
          isLoading={aggregateQuery.isLoading}
          range={timeRange}
        />
        <AnalyzeCompositionRow window={timeWindow} />
        <AnalyzeContentRow
          aggregate={aggregate}
          isLoading={aggregateQuery.isLoading}
          window={timeWindow}
        />
        <AnalyzeActivityPanel />
        <AnalyzeRecordsCollapsible />
      </Scroll>
    </AppPage>
  )
}
