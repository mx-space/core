import { useQuery } from '@tanstack/react-query'
import { BookOpen, Calendar } from 'lucide-react'

import { getReadingRank } from '~/api/activity'
import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { analyzeQueryKey } from '../../constants'
import { formatDateTime } from '../../utils/analyze'
import { AnalyzeSkeleton, EmptyBlock, ErrorBlock } from '../AnalyzePrimitives'
import { ReadingRankList } from '../ReadingRankList'

export function AnalyzeRankPanel(props: {
  window: { start: number; end: number }
}) {
  const { t } = useI18n()

  const readingRankQuery = useQuery({
    queryFn: () =>
      getReadingRank({
        end: props.window.end,
        limit: 10,
        start: props.window.start,
      }),
    queryKey: [...analyzeQueryKey, 'reading-rank', props.window],
  })

  return (
    <Panel
      description={t('analyze.rank.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <BookOpen aria-hidden="true" className="size-4" />
          {t('analyze.rank.title')}
        </span>
      }
    >
      <div className="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-900 dark:text-neutral-400">
        <Calendar aria-hidden="true" className="mr-1.5 inline size-3.5" />
        {formatDateTime(new Date(props.window.start).toISOString())} -
        {formatDateTime(new Date(props.window.end).toISOString())}
      </div>
      {readingRankQuery.isLoading ? (
        <AnalyzeSkeleton />
      ) : readingRankQuery.isError ? (
        <ErrorBlock
          label={t('analyze.rank.error')}
          onRetry={() => void readingRankQuery.refetch()}
        />
      ) : readingRankQuery.data?.length ? (
        <ReadingRankList items={readingRankQuery.data} />
      ) : (
        <EmptyBlock label={t('analyze.rank.empty')} />
      )}
    </Panel>
  )
}
