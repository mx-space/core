import { RefreshCw, Search } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export function SearchIndexRebuildCard(props: {
  forceLoading: boolean
  incrementalLoading: boolean
  onForceRebuild: () => void
  onIncrementalRebuild: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="bg-white p-4 dark:bg-neutral-950">
      <Search className="mb-3 size-5 text-neutral-400" />
      <div className="text-sm text-neutral-500">
        {t('dashboard.maintenance.searchIndex.label')}
      </div>
      <div className="mt-1 text-lg font-semibold">
        {t('dashboard.maintenance.searchIndex.value')}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-neutral-400 dark:text-neutral-500">
        {t('dashboard.maintenance.searchIndex.description')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={props.incrementalLoading || props.forceLoading}
          onClick={props.onIncrementalRebuild}
          type="button"
          variant="subtle"
        >
          {props.incrementalLoading ? (
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('dashboard.maintenance.searchIndex.incremental')}
        </Button>
        <Button
          className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-950 dark:text-amber-300 dark:hover:bg-amber-950/30"
          disabled={props.incrementalLoading || props.forceLoading}
          onClick={props.onForceRebuild}
          type="button"
          variant="subtle"
        >
          {props.forceLoading ? (
            <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('dashboard.maintenance.searchIndex.force')}
        </Button>
      </div>
    </div>
  )
}
