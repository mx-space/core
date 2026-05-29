import { Loader2, RotateCcw } from 'lucide-react'
import type { DraftDiffStats, VersionItem } from '../types/drafts'

import { useI18n } from '~/i18n'
import { ListRow } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { relativeTimeFromNow } from '~/utils/time'

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
      className="data-selected:bg-neutral-100 dark:data-selected:bg-neutral-900 group flex w-full cursor-default items-center gap-3 border-b border-neutral-100 px-4 py-3 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 dark:border-neutral-800/60 dark:hover:bg-neutral-900/70 dark:focus-visible:outline-neutral-500"
      dataId={String(props.item.version)}
      onSelect={() => props.onSelect()}
      role="row"
      selected={props.selected}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
            v{props.item.version}
          </span>
          {props.item.isCurrent ? (
            <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {t('drafts.version.current')}
            </span>
          ) : null}
          {props.item.isFullSnapshot !== undefined ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {props.item.isFullSnapshot
                ? t('drafts.version.full')
                : t('drafts.version.incremental')}
            </span>
          ) : null}
          {props.item.refVersion !== undefined ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              = v{props.item.refVersion}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {props.item.title || t('drafts.row.untitled')} ·{' '}
          {relativeTimeFromNow(props.item.savedAt)}
        </p>
      </div>
      {props.diffStats ? (
        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
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
          aria-label={t('drafts.version.restoreAria', {
            version: props.item.version,
          })}
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
