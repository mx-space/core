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
    <footer className="border-t border-border pb-4 pt-4 text-center text-xs leading-6 text-fg-subtle">
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
          className="inline-flex size-6 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg"
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
          className="inline-flex h-6 items-center gap-1 rounded-sm border border-border px-2 text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
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
