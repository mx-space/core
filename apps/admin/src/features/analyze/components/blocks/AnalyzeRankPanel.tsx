import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'

import { getReadingRank } from '~/api/activity'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Panel } from '~/ui/primitives/panel'

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
    queryKey: adminQueryKeys.analyze.readingRank({
      end: props.window.end,
      limit: 10,
      start: props.window.start,
    }),
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
