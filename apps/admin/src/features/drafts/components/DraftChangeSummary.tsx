import { Archive, GitCompare, History } from 'lucide-react'
import { useMemo } from 'react'

import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { RevisionSnapshot } from '~/models/draft'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import type { SummaryBlock } from '../utils/change-summary'
import { summarizeDraftChanges } from '../utils/change-summary'

const KIND_STYLE: Record<SummaryBlock['kind'], string> = {
  added: 'border-l-emerald-500',
  changed: 'border-l-amber-500',
  fresh: 'border-l-border-strong',
  removed: 'border-l-red-500',
}

export function DraftChangeSummary(props: {
  compactBusy: boolean
  draft: RevisionSnapshot
  onCompact: () => void
  onOpenCompare: () => void
  onShowHistory: () => void
  published: RevisionSnapshot | null
  reclaimBytes: number
  snapshotBytes: number
  snapshotCount: number
}) {
  const { t } = useI18n()
  const summary = useMemo(
    () => summarizeDraftChanges(props.published, props.draft),
    [props.draft, props.published],
  )
  const total = summary.added + summary.changed + summary.removed
  const hidden = total - summary.blocks.length

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-card p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-fg">
            {summary.fresh
              ? t('drafts.summary.freshTitle')
              : t('drafts.summary.title')}
          </h3>
          {summary.fresh ? null : (
            <span className="text-xs text-fg-muted">
              {total === 0
                ? summary.otherChanges
                  ? t('drafts.summary.otherChanges')
                  : t('drafts.summary.same')
                : t('drafts.summary.counts', {
                    added: summary.added,
                    changed: summary.changed,
                    removed: summary.removed,
                  })}
            </span>
          )}
          {summary.wordDelta === 0 ? null : (
            <span className="text-xs tabular-nums text-fg-subtle">
              {t('drafts.summary.words', {
                delta:
                  summary.wordDelta > 0
                    ? `+${summary.wordDelta}`
                    : String(summary.wordDelta),
              })}
            </span>
          )}
          {summary.fresh ? null : (
            <Button
              className="ml-auto h-7 px-2 text-xs"
              onClick={props.onOpenCompare}
              type="button"
              variant="subtle"
            >
              <GitCompare aria-hidden="true" className="size-3.5" />
              {t('drafts.summary.openCompare')}
            </Button>
          )}
        </div>
        {summary.blocks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {summary.blocks.map((block, index) => (
              <li
                className={cn(
                  'flex flex-col gap-1 border-l-2 bg-surface-inset/60 px-3 py-2 text-sm',
                  KIND_STYLE[block.kind],
                )}
                key={index}
              >
                <span className="text-xs text-fg-subtle">
                  {t(`drafts.summary.kind.${block.kind}`)}
                </span>
                {block.kind === 'changed' ? (
                  <span className="line-clamp-2 text-fg-subtle line-through">
                    {block.before}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'line-clamp-3',
                    block.kind === 'removed'
                      ? 'text-fg-subtle line-through'
                      : 'text-fg',
                  )}
                >
                  {block.text}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {!summary.fresh && hidden > 0 ? (
          <span className="text-xs text-fg-muted">
            {t('drafts.summary.more', { count: hidden })}
          </span>
        ) : null}
      </section>

      <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 text-sm">
        <History aria-hidden="true" className="size-4 text-fg-subtle" />
        <span className="flex-1 text-fg-muted">
          {t('drafts.summary.snapshots', {
            count: props.snapshotCount,
            size: formatBytes(props.snapshotBytes),
          })}
        </span>
        <Button
          className="h-7 px-2 text-xs"
          disabled={props.compactBusy || props.reclaimBytes === 0}
          onClick={props.onCompact}
          type="button"
          variant="subtle"
        >
          <Archive aria-hidden="true" className="size-3.5" />
          {t('drafts.summary.compact')}
        </Button>
        <Button
          className="h-7 px-2 text-xs"
          onClick={props.onShowHistory}
          type="button"
          variant="subtle"
        >
          {t('drafts.summary.viewAll')}
        </Button>
      </div>
    </div>
  )
}
