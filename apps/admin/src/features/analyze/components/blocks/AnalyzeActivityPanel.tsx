import { useQuery } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { useState } from 'react'

import { ActivityType, getActivityList } from '~/api/activity'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Panel } from '~/ui/primitives/panel'
import { cn } from '~/utils/cn'

import { activityPageSize } from '../../constants'
import { buildRefObjectMap } from '../../utils/analyze'
import { ActivityList } from '../ActivityList'
import { AnalyzeSkeleton, EmptyBlock, ErrorBlock } from '../AnalyzePrimitives'

export function AnalyzeActivityPanel() {
  const { t } = useI18n()
  const [activityType, setActivityType] = useState<ActivityType>(
    ActivityType.Like,
  )
  const [activityPage, setActivityPage] = useState(1)

  const activityQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getActivityList({
        page: activityPage,
        size: activityPageSize,
        type: activityType,
      }),
    queryKey: adminQueryKeys.analyze.activity({
      page: activityPage,
      size: activityPageSize,
      type: activityType,
    }),
  })

  const activities = activityQuery.data?.data ?? []
  const activityPagination = activityQuery.data?.pagination
  const refObjects = buildRefObjectMap(activityQuery.data?.objects)

  return (
    <Panel
      description={t('analyze.visitor.description')}
      title={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Heart aria-hidden="true" className="size-4" />
            {t('analyze.activity.title')}
          </span>
          <div className="flex rounded-sm border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
            {(
              [
                [ActivityType.Like, t('analyze.activity.likeRecord')],
                [ActivityType.ReadDuration, t('analyze.activity.readRecord')],
              ] as const
            ).map(([value, label]) => (
              <button
                className={cn(
                  'h-8 rounded-xs px-3 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-neutral-50',
                  activityType === value &&
                    'bg-neutral-950 text-white hover:text-white dark:bg-neutral-50 dark:text-neutral-950 dark:hover:text-neutral-950',
                )}
                key={value}
                onClick={() => {
                  setActivityType(value)
                  setActivityPage(1)
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {activityQuery.isLoading && activities.length === 0 ? (
        <AnalyzeSkeleton />
      ) : activityQuery.isError ? (
        <ErrorBlock
          label={t('analyze.activity.error')}
          onRetry={() => void activityQuery.refetch()}
        />
      ) : activities.length ? (
        <ActivityList
          items={activities}
          refObjects={refObjects}
          type={activityType}
        />
      ) : (
        <EmptyBlock
          label={
            activityType === ActivityType.Like
              ? t('analyze.activity.empty.like')
              : t('analyze.activity.empty.read')
          }
        />
      )}

      {activityPagination && activityPagination.totalPages > 1 ? (
        <div className="flex items-center justify-end border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <CompactPagination
            onPageChange={setActivityPage}
            onPageSizeChange={() => undefined}
            page={activityPage}
            pageCount={activityPagination.totalPages}
            pageSize={activityPageSize}
            pageSizes={[activityPageSize]}
          />
        </div>
      ) : null}
    </Panel>
  )
}
