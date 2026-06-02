import { CheckCheck, ShieldAlert, Trash2, X } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

export interface SelectionBarProps {
  selectedCount: number
  isAllPageMode: boolean
  totalAvailable: number
  onSelectAllAcrossPages?: () => void
  onMarkRead: () => void
  onMarkJunk: () => void
  onDelete: () => void
  onClear: () => void
  canMarkRead: boolean
  canMarkJunk: boolean
}

export function SelectionBar(props: SelectionBarProps) {
  const { format, t } = useI18n()

  const showSelectAllCta =
    !props.isAllPageMode &&
    props.totalAvailable > props.selectedCount &&
    Boolean(props.onSelectAllAcrossPages)

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm"
      data-testid="comments-selection-bar"
    >
      <span
        className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
        data-testid="comments-selection-pill"
      >
        {t('comments.list.selectedCount', {
          count: format.number(props.selectedCount),
        })}
      </span>

      {showSelectAllCta ? (
        <button
          className="text-xs text-accent hover:underline focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
          data-testid="comments-select-across-pages"
          onClick={props.onSelectAllAcrossPages}
          type="button"
        >
          {t('comments.list.selectAcrossPages', {
            count: format.number(props.totalAvailable),
          })}
        </button>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <Button
          className="h-8 px-2"
          data-testid="comments-bulk-mark-read"
          disabled={!props.canMarkRead}
          onClick={props.onMarkRead}
          type="button"
          variant="subtle"
        >
          <CheckCheck aria-hidden="true" className="size-3.5" />
          {t('comments.action.bulkMarkRead')}
        </Button>
        <Button
          className="h-8 px-2"
          data-testid="comments-bulk-mark-junk"
          disabled={!props.canMarkJunk}
          onClick={props.onMarkJunk}
          type="button"
          variant="subtle"
        >
          <ShieldAlert aria-hidden="true" className="size-3.5" />
          {t('comments.action.bulkMarkJunk')}
        </Button>
        <Button
          className="h-8 px-2 text-red-600 dark:text-red-400"
          data-testid="comments-bulk-delete"
          onClick={props.onDelete}
          type="button"
          variant="subtle"
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
          {t('comments.action.bulkDelete')}
        </Button>
        <Button
          aria-label={t('comments.action.clearSelection')}
          className="h-8 px-2"
          data-testid="comments-bulk-clear"
          iconOnly
          onClick={props.onClear}
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
