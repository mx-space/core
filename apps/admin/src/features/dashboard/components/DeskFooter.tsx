import { useI18n } from '~/i18n'

import { formatVersionLabel } from '../utils/desk'

export function DeskFooter(props: {
  adminVersion: string
  onCheckUpdates: () => void
  refreshing: boolean
  systemVersion: string
}) {
  const { t } = useI18n()

  return (
    <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-fg-subtle">
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
    </footer>
  )
}
