import { TriangleAlert } from 'lucide-react'

import { useI18n } from '~/i18n'

export function DeskLoadError(props: {
  onRetry: () => void
  retrying: boolean
}) {
  const { t } = useI18n()

  return (
    <p className="flex items-center gap-2 text-sm text-fg-muted">
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      {t('dashboard.desk.error.text')}
      <button
        className="focus-visible:outline-hidden rounded-xs text-accent transition-opacity hover:underline focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:opacity-50"
        disabled={props.retrying}
        onClick={props.onRetry}
        type="button"
      >
        {t('common.retry')}
      </button>
    </p>
  )
}
