import { Download, RefreshCw } from 'lucide-react'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

export function DashboardRuntimeFooter(props: {
  adminLatestVersion?: string
  adminVersion: string
  onCheckUpdates: () => void
  onOpenUpgrade: () => void
  pageSource: string
  refreshing: boolean
  systemLatestVersion?: string
  systemVersion: string
}) {
  const { t } = useI18n()
  return (
    <footer className="border-t border-neutral-100 pb-4 pt-4 text-center text-xs leading-6 text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
      <div className="inline-flex flex-wrap items-center justify-center gap-2">
        <span>
          {props.adminLatestVersion
            ? t('dashboard.footer.adminVersionWithLatest', {
                latest: props.adminLatestVersion,
                version: props.adminVersion,
              })
            : t('dashboard.footer.adminVersion', {
                version: props.adminVersion,
              })}
        </span>
        <button
          aria-label={t('dashboard.footer.checkUpdates')}
          className="inline-flex size-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
          disabled={props.refreshing}
          onClick={props.onCheckUpdates}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-3.5', props.refreshing && 'animate-spin')}
          />
        </button>
        <button
          className="inline-flex h-6 items-center gap-1 rounded border border-neutral-200 px-2 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          onClick={props.onOpenUpgrade}
          type="button"
        >
          <Download aria-hidden="true" className="size-3" />
          {t('dashboard.footer.updatePanel')}
        </button>
      </div>
      <div>
        {props.systemLatestVersion
          ? t('dashboard.footer.systemVersionWithLatest', {
              latest: props.systemLatestVersion,
              version: props.systemVersion,
            })
          : t('dashboard.footer.systemVersion', {
              version: props.systemVersion,
            })}
      </div>
      <div>
        {t('dashboard.footer.pageSource', {
          source: props.pageSource || 'N/A',
        })}
      </div>
    </footer>
  )
}
