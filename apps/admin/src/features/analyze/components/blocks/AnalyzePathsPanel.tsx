import { ChartLine } from 'lucide-react'
import type { IPAggregate } from '~/api/analyze'

import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { AnalyzeSkeleton, EmptyBlock } from '../AnalyzePrimitives'

export function AnalyzePathsPanel(props: {
  aggregate: IPAggregate | undefined
  isLoading: boolean
}) {
  const { t } = useI18n()
  const { aggregate } = props

  return (
    <Panel
      description={t('analyze.path.description')}
      title={
        <span className="inline-flex items-center gap-2">
          <ChartLine aria-hidden="true" className="size-4" />
          {t('analyze.path.title')}
        </span>
      }
    >
      {props.isLoading ? (
        <AnalyzeSkeleton />
      ) : aggregate?.paths.length ? (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {aggregate.paths.slice(0, 10).map((path) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3"
              key={path.path}
            >
              <span className="truncate text-sm text-neutral-800 dark:text-neutral-100">
                {path.path}
              </span>
              <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {path.count}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyBlock label={t('analyze.path.empty')} />
      )}
    </Panel>
  )
}
