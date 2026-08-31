import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getDraftRevisions } from '~/api/drafts'
import { useI18n } from '~/i18n'
import type { DraftModel, VersionTreeNode } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { cn } from '~/utils/cn'

import { ChangeSummary, TitleChangeLine } from './ChangeSummary'
import type { DraftActionHandlers } from './DraftActions'
import { DraftActions } from './DraftActions'

export function DraftNode(props: {
  deleting: boolean
  draft: DraftModel
  handlers: DraftActionHandlers
  node: VersionTreeNode
}) {
  const { format, t } = useI18n()

  return (
    <article
      className={cn(
        'rounded-lg border border-accent/40 bg-accent-soft',
        props.deleting && 'pointer-events-none opacity-50',
      )}
    >
      <button
        aria-current="true"
        className="flex w-full flex-col gap-1 px-3 pb-2 pt-2.5 text-left focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onClick={props.handlers.onCompare}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {t('write.versionTree.currentEditing')}
          </span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-fg-subtle">
            {format.relativeTime(
              props.draft.updatedAt ?? props.draft.createdAt,
            )}
          </span>
        </span>
        <ChangeSummary
          base={props.draft.baseRevision}
          head={props.draft.headRevision}
        />
        <TitleChangeLine
          base={props.draft.baseRevision}
          head={props.draft.headRevision}
        />
      </button>

      <div className="flex items-center gap-0.5 border-t border-accent/20 px-2 py-1.5">
        <DraftActions
          deleting={props.deleting}
          draft={props.draft}
          handlers={props.handlers}
          labelled
        />
      </div>

      {props.node.collapsedRevisionCount > 0 ? (
        <DraftAutosaves
          count={props.node.collapsedRevisionCount}
          draftId={props.draft.id}
          parentNodeId={props.node.parentNodeId}
        />
      ) : null}
    </article>
  )
}

function DraftAutosaves(props: {
  count: number
  draftId: string
  parentNodeId: string | null
}) {
  const { format, t } = useI18n()
  const [open, setOpen] = useState(false)
  const revisionsQuery = useQuery({
    enabled: open,
    queryFn: () => getDraftRevisions(props.draftId),
    queryKey: adminQueryKeys.drafts.history(props.draftId),
  })
  const hiddenRevisions = useMemo(() => {
    const revisions = revisionsQuery.data ?? []
    const parentIndex = props.parentNodeId
      ? revisions.findIndex((revision) => revision.id === props.parentNodeId)
      : revisions.length
    return revisions
      .slice(1, parentIndex < 0 ? 1 + props.count : parentIndex)
      .reverse()
  }, [props.count, props.parentNodeId, revisionsQuery.data])

  return (
    <div className="border-t border-dashed border-accent/20 px-2 py-1">
      <button
        aria-expanded={open}
        className="flex h-7 items-center gap-1.5 rounded-sm px-1.5 text-xs text-fg-subtle transition-colors hover:bg-surface-inset hover:text-fg focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
        {t('write.versionTree.collapsed', { count: props.count })}
      </button>
      {open ? (
        <div className="ml-3 border-l border-dashed border-border py-1 pl-3">
          {revisionsQuery.isLoading ? (
            <Loader2
              aria-label={t('common.loading')}
              className="my-2 size-3.5 animate-spin text-fg-muted"
            />
          ) : (
            hiddenRevisions.map((revision) => (
              <div className="py-1 text-xs text-fg-muted" key={revision.id}>
                <span className="block truncate">
                  {revision.title || t('write.editor.untitled')}
                </span>
                <span className="tabular-nums">
                  {format.relativeTime(revision.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
