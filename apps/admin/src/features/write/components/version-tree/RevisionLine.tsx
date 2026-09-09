import { Link2 } from 'lucide-react'

import { useI18n } from '~/i18n'
import type { DraftModel, VersionTreeNode } from '~/models/draft'
import { cn } from '~/utils/cn'

import { ChangeSummary } from './ChangeSummary'
import type { DraftActionHandlers } from './DraftActions'
import { DraftActions } from './DraftActions'

export function ShareMark() {
  const { t } = useI18n()

  return (
    <span
      className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      title={t('write.share.linkedHere')}
    >
      <Link2 aria-label={t('write.share.linkedHere')} className="size-3" />
    </span>
  )
}

export function DraftLine(props: {
  deleting: boolean
  draft: DraftModel
  handlers: DraftActionHandlers
  shared: boolean
}) {
  const { format, t } = useI18n()
  const diverged = props.draft.relationToPublished === 'diverged'

  return (
    <div
      className={cn(
        'group flex min-h-9 items-center gap-2 rounded-md px-2 transition-colors hover:bg-surface-inset focus-within:bg-surface-inset',
        props.deleting && 'pointer-events-none opacity-50',
      )}
    >
      {diverged ? (
        <span
          aria-hidden="true"
          className="my-1.5 w-0.5 shrink-0 self-stretch rounded-full bg-amber-500"
        />
      ) : null}
      {props.shared ? <ShareMark /> : null}
      <button
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onClick={props.handlers.onCompare}
        type="button"
      >
        {diverged ? (
          <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            {t('write.branch.relation.diverged')}
          </span>
        ) : null}
        <ChangeSummary
          base={props.draft.baseRevision}
          head={props.draft.headRevision}
        />
      </button>
      <span className="shrink-0 text-xs tabular-nums text-fg-subtle group-focus-within:hidden group-hover:hidden group-has-[[data-popup-open]]:hidden">
        {format.relativeTime(props.draft.updatedAt ?? props.draft.createdAt)}
      </span>
      <span className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex group-has-[[data-popup-open]]:flex [@media(pointer:coarse)]:flex">
        <DraftActions
          deleting={props.deleting}
          draft={props.draft}
          handlers={props.handlers}
          labelled={false}
        />
      </span>
    </div>
  )
}

export function RevisionLine(props: {
  node: VersionTreeNode
  onShare: () => void
  shared: boolean
}) {
  const { format, t } = useI18n()

  return (
    <div className="group flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-inset focus-within:bg-surface-inset">
      {props.shared ? <ShareMark /> : null}
      <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
        {props.node.revision.title || t('write.editor.untitled')}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-fg-subtle group-focus-within:hidden group-hover:hidden">
        {props.node.publishedAt
          ? t('write.versionTree.publishedAt', {
              time: format.relativeTime(props.node.publishedAt),
            })
          : format.relativeTime(props.node.revision.createdAt)}
      </span>
      <button
        className="hidden shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-accent transition-colors hover:bg-accent-soft focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15 group-focus-within:flex group-hover:flex [@media(pointer:coarse)]:flex"
        onClick={props.onShare}
        type="button"
      >
        <Link2 aria-hidden="true" className="size-3" />
        {t('write.share.shareRevision')}
      </button>
    </div>
  )
}
