import { useI18n } from '~/i18n'

import { formatVersionLabel } from '../utils/desk'

export function DeskFooter(props: {
  adminVersion: string
  onCheckUpdates: () => void
  online: number
  refreshing: boolean
  systemVersion: string
  todayMaxOnline: number
  todayVisitors: number
}) {
  const { format, t } = useI18n()

  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-fg-subtle">
      <span className="inline-flex items-center gap-2">
        <span>
          {t('dashboard.footer.versions', {
            admin: formatVersionLabel(props.adminVersion),
            system: formatVersionLabel(props.systemVersion),
          })}
        </span>
        <button
          className="focus-visible:outline-hidden rounded-xs transition-colors hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:opacity-50"
          disabled={props.refreshing}
          onClick={props.onCheckUpdates}
          type="button"
        >
          {t('dashboard.footer.checkUpdates')}
        </button>
      </span>
      <span className="tabular-nums">
        {t('dashboard.footer.live', {
          max: format.number(props.todayMaxOnline),
          online: format.number(props.online),
          visitors: format.number(props.todayVisitors),
        })}
      </span>
    </footer>
  )
}
