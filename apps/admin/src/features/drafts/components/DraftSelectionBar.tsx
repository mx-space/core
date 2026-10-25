import { Archive, Trash2 } from 'lucide-react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { DraftCard } from '~/models/draft'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'

export function DraftSelectionBar(props: {
  allSelected: boolean
  busy: boolean
  indeterminate: boolean
  onCompact: () => void
  onDelete: () => void
  onSelectAll: (checked: boolean) => void
  selected: DraftCard[]
}) {
  const { t } = useI18n()
  const count = props.selected.length
  const bytes = props.selected.reduce(
    (sum, draft) => sum + draft.storage.revisionBytes + draft.storage.crdtBytes,
    0,
  )

  return (
    <div
      className={
        count > 0
          ? 'flex h-10 shrink-0 items-center gap-2 border-b border-accent/20 bg-accent-soft px-4 text-xs'
          : 'flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-inset/60 px-4 text-xs'
      }
    >
      <Checkbox
        aria-label={t('drafts.list.selectAllVisible')}
        checked={props.allSelected}
        indeterminate={props.indeterminate}
        onCheckedChange={props.onSelectAll}
      />
      {count > 0 ? (
        <>
          <span className="min-w-0 truncate">
            <span className="font-medium text-fg">
              {t('drafts.list.selectedCount', { count })}
            </span>{' '}
            <span className="text-fg-muted">
              {t('drafts.list.selectedBytes', { size: formatBytes(bytes) })}
            </span>
          </span>
          <span className="flex-1" />
          <Button
            className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
            disabled={props.busy}
            onClick={props.onCompact}
            type="button"
            variant="secondary"
          >
            <Archive aria-hidden="true" className="size-3.5" />
            {t('drafts.compact.action')}
          </Button>
          <Button
            className="h-7 shrink-0 whitespace-nowrap bg-red-600 px-2 text-xs text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            disabled={props.busy}
            onClick={props.onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {t('drafts.list.bulkDelete')}
          </Button>
        </>
      ) : (
        <span className="text-fg-muted">
          {t('drafts.list.selectAllVisible')}
        </span>
      )}
    </div>
  )
}
