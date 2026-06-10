import { useQuery } from '@tanstack/react-query'
import { Route } from 'lucide-react'

import { getTrafficSource } from '~/api/analyze'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Panel } from '~/ui/primitives/panel'
import { cn } from '~/utils/cn'

import { formatNumber } from '../../utils/analyze'
import { AnalyzeSkeleton, EmptyBlock, ErrorBlock } from '../AnalyzePrimitives'
import { BarList } from '../BarList'

const CATEGORY_FILLS = [
  'bg-accent',
  'bg-fg/70',
  'bg-fg/45',
  'bg-fg/25',
  'bg-fg/15',
  'bg-fg/10',
]

function CategorySummary(props: {
  categories: Array<{ name: string; value: number }>
}) {
  const { t } = useI18n()
  const total = props.categories.reduce((sum, item) => sum + item.value, 0)
  if (total === 0) return null

  return (
    <div>
      <div className="flex h-2 gap-px overflow-hidden rounded-sm bg-surface-inset">
        {props.categories.map((category, index) => (
          <span
            className={cn(
              'h-full',
              CATEGORY_FILLS[index % CATEGORY_FILLS.length],
            )}
            key={category.name}
            style={{ width: `${(category.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {props.categories.map((category, index) => (
          <span
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted"
            key={category.name}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                CATEGORY_FILLS[index % CATEGORY_FILLS.length],
              )}
            />
            {category.name || t('analyze.distribution.unknown')}
            <span className="tabular-nums text-fg-subtle">
              {formatNumber(category.value)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function AnalyzeSourcesPanel(props: {
  window: { start: number; end: number }
}) {
  const { t } = useI18n()

  const trafficSourceQuery = useQuery({
    queryFn: () =>
      getTrafficSource({
        from: String(props.window.start),
        to: String(props.window.end),
      }),
    queryKey: adminQueryKeys.analyze.trafficSource({
      end: props.window.end,
      start: props.window.start,
    }),
  })
  const data = trafficSourceQuery.data

  return (
    <Panel
      description={t('analyze.traffic.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <Route aria-hidden="true" className="size-4" />
          {t('analyze.traffic.title')}
        </span>
      }
    >
      {trafficSourceQuery.isLoading ? (
        <AnalyzeSkeleton />
      ) : trafficSourceQuery.isError ? (
        <ErrorBlock
          label={t('analyze.traffic.error')}
          onRetry={() => void trafficSourceQuery.refetch()}
        />
      ) : data?.categories.length || data?.details.length ? (
        <div className="space-y-4 p-4">
          {data.categories.length ? (
            <CategorySummary categories={data.categories} />
          ) : null}
          {data.details.length ? (
            <BarList
              items={data.details.slice(0, 8).map((item) => ({
                key: item.source || 'direct',
                label: item.source || t('analyze.traffic.direct'),
                title: item.source || t('analyze.traffic.direct'),
                value: item.count,
              }))}
            />
          ) : null}
        </div>
      ) : (
        <EmptyBlock label={t('analyze.traffic.empty')} />
      )}
    </Panel>
  )
}
