import { AlertTriangle } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

interface DraftConflictBannerProps {
  conflictCount: number
  onKeepLocal: () => void
  onUseRemote: () => void
  remoteVersion: number
}

export function DraftConflictBanner(props: DraftConflictBannerProps) {
  const { t } = useI18n()

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
      role="alert"
    >
      <AlertTriangle
        aria-hidden="true"
        className="size-4 shrink-0 text-red-600 dark:text-red-400"
      />
      <span className="min-w-64 flex-1 text-sm">
        {t('write.conflict.message', {
          count: props.conflictCount,
          version: props.remoteVersion,
        })}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={props.onUseRemote}
          type="button"
          variant="secondary"
        >
          {t('write.conflict.useRemote')}
        </Button>
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={props.onKeepLocal}
          type="button"
        >
          {t('write.conflict.keepLocal')}
        </Button>
      </div>
    </div>
  )
}
