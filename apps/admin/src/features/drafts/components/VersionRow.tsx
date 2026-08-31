import { Loader2, RotateCcw } from 'lucide-react'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { relativeTimeFromNow } from '~/utils/time'

import type { DraftDiffStats, VersionItem } from '../types/drafts'

export function VersionRow(props: {
  diffStats: DraftDiffStats | null
  item: VersionItem
  onRestore: () => void
  onSelect: () => void
  restorePending: boolean
  selected: boolean
}) {
  const { t } = useI18n()
  return (
    <ListRow
      as="article"
      ariaCurrent={props.selected}
      className="data-selected:bg-accent-soft data-selected:text-fg group flex w-full cursor-default items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface-inset focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent/40"
      dataId={props.item.id}
      onSelect={() => props.onSelect()}
      role="row"
      selected={props.selected}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-fg">
            {props.item.isCurrent
              ? t('drafts.version.current')
              : relativeTimeFromNow(props.item.savedAt)}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-fg-muted">
          {props.item.title || t('drafts.row.untitled')}
        </p>
      </div>
      {props.diffStats ? (
        <span className="shrink-0 text-xs tabular-nums text-fg-muted">
          {props.diffStats.isSame
            ? t('drafts.version.same')
            : t('drafts.version.diffChars', {
                delta: props.diffStats.delta,
                sign: props.diffStats.delta > 0 ? '+' : '',
              })}
        </span>
      ) : null}
      {!props.item.isCurrent ? (
        <Button
          aria-label={t('drafts.version.restoreAria')}
          className="h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected]:opacity-100"
          disabled={props.restorePending}
          onClick={(event) => {
            event.stopPropagation()
            props.onRestore()
          }}
          type="button"
          variant="subtle"
        >
          {props.restorePending ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <RotateCcw aria-hidden="true" className="size-3.5" />
          )}
        </Button>
      ) : null}
    </ListRow>
  )
}
