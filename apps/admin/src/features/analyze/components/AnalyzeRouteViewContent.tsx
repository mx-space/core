import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { getAnalyzeAggregate } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Scroll } from '~/ui/primitives/scroll'

import type { TimeRange } from '../types/analyze'
import { getTimeWindow } from '../utils/analyze'
import { AnalyzeActions } from './blocks/AnalyzeActions'
import { AnalyzeActivityPanel } from './blocks/AnalyzeActivityPanel'
import { AnalyzeDevicesPanel } from './blocks/AnalyzeDevicesPanel'
import { AnalyzeHeroPanel } from './blocks/AnalyzeHeroPanel'
import { AnalyzePathsPanel } from './blocks/AnalyzePathsPanel'
import { AnalyzeRankPanel } from './blocks/AnalyzeRankPanel'
import { AnalyzeRecordsDrawer } from './blocks/AnalyzeRecordsDrawer'
import { AnalyzeSourcesPanel } from './blocks/AnalyzeSourcesPanel'

export function AnalyzeRouteViewContent() {
  const { t } = useI18n()
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [recordsOpen, setRecordsOpen] = useState(false)
  const timeWindow = useMemo(() => getTimeWindow(timeRange), [timeRange])

  const aggregateQuery = useQuery({
    queryFn: getAnalyzeAggregate,
    queryKey: adminQueryKeys.analyze.aggregate(),
  })

  const aggregate = aggregateQuery.data

  return (
    <AppPage>
      <PageHeader
        actions={
          <AnalyzeActions
            onOpenRecords={() => setRecordsOpen(true)}
            onRangeChange={setTimeRange}
            range={timeRange}
          />
        }
        description={t('analyze.page.description')}
        title={t('analyze.page.title')}
      />

      <Scroll className="min-h-0 flex-1" innerClassName="space-y-6 p-4">
        <AnalyzeHeroPanel
          aggregate={aggregate}
          isLoading={aggregateQuery.isLoading}
          range={timeRange}
        />
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyzePathsPanel
            aggregate={aggregate}
            isLoading={aggregateQuery.isLoading}
          />
          <AnalyzeSourcesPanel window={timeWindow} />
        </div>
        <AnalyzeDevicesPanel window={timeWindow} />
        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyzeRankPanel window={timeWindow} />
          <AnalyzeActivityPanel />
        </div>
      </Scroll>

      <AnalyzeRecordsDrawer
        onClose={() => setRecordsOpen(false)}
        open={recordsOpen}
      />
    </AppPage>
  )
}
