import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Loader2, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { listCollaborators } from '~/api/collab'
import type { SetDraftShareData } from '~/api/drafts'
import {
  deleteDraftShare,
  getDraftHistory,
  getDraftShare,
  restoreDraftRevision,
  setDraftShare,
  undoDraftChange,
} from '~/api/drafts'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import type { CheckpointKind, DraftShare } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { subscribeDraftUpdate } from '~/socket/draft-update-signal'
import { confirmDialog } from '~/ui/feedback/confirm'
import { AsidePanel } from '~/ui/layout/content-layout'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { CollaboratorsSection } from './collab/CollaboratorsSection'
import {
  buildTimeline,
  type StepKind,
  type TimelineCheckpoint,
  type TimelineRow,
  type TimelineStep,
} from './timeline/build-timeline'
import { ShareBar } from './version-tree/ShareBar'

const ROW_LIMIT = 200

const checkpointLabels: Record<CheckpointKind | 'legacy', TranslationKey> = {
  import: 'write.timeline.checkpoint.import',
  legacy: 'write.timeline.checkpoint.legacy',
  'legacy-save': 'write.timeline.checkpoint.legacySave',
  publish: 'write.timeline.checkpoint.publish',
  restore: 'write.timeline.checkpoint.restore',
  save: 'write.timeline.checkpoint.save',
  undo: 'write.timeline.checkpoint.undo',
}

const stepLabels: Record<StepKind, TranslationKey> = {
  agent: 'write.timeline.step.agent',
  human: 'write.timeline.step.human',
  other: 'write.timeline.step.other',
  restore: 'write.timeline.step.restore',
  undo: 'write.timeline.step.undo',
}

export interface TimelinePanelProps {
  documentId: string | null
  draftId: string
  onBeforeChange: () => Promise<void>
  onChanged: (change: { restored: boolean }) => Promise<void> | void
  onClose: () => void
  publishedRevisionId: string | null
}

export function TimelinePanel(props: TimelinePanelProps) {
  const { format, t } = useI18n()
  const queryClient = useQueryClient()
  const { draftId, documentId } = props
  const historyKey = adminQueryKeys.drafts.timeline(draftId)
  const historyQuery = useQuery({
    enabled: Boolean(draftId),
    queryFn: () => getDraftHistory(draftId),
    queryKey: historyKey,
  })

  useEffect(
    () =>
      subscribeDraftUpdate((payload) => {
        if (payload.branchId !== draftId) return
        void queryClient.invalidateQueries({
          queryKey: adminQueryKeys.drafts.timeline(draftId),
        })
      }),
    [draftId, queryClient],
  )

  const collaboratorsQuery = useQuery({
    enabled: Boolean(documentId),
    queryFn: () => listCollaborators(documentId!),
    queryKey: adminQueryKeys.collab.collaborators(documentId ?? ''),
  })
  const authorNames = useMemo(
    () =>
      new Map(
        (collaboratorsQuery.data ?? []).map((person) => [
          person.readerId,
          person.name,
        ]),
      ),
    [collaboratorsQuery.data],
  )

  const rows = useMemo(
    () =>
      historyQuery.data
        ? buildTimeline(historyQuery.data, props.publishedRevisionId).slice(
            0,
            ROW_LIMIT,
          )
        : [],
    [historyQuery.data, props.publishedRevisionId],
  )

  const afterChange = async (restored: boolean) => {
    await props.onChanged({ restored })
    await queryClient.invalidateQueries({ queryKey: historyKey })
  }
  const restoreMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      await props.onBeforeChange()
      return restoreDraftRevision(draftId, revisionId)
    },
    onError: () => toast.error(t('write.timeline.failed')),
    onSuccess: async () => {
      await afterChange(true)
      toast.success(t('write.timeline.restored'))
    },
  })
  const undoMutation = useMutation({
    mutationFn: async (step: TimelineStep) => {
      await props.onBeforeChange()
      return undoDraftChange(draftId, step.change, step.before)
    },
    onError: () => toast.error(t('write.timeline.failed')),
    onSuccess: async () => {
      await afterChange(false)
      toast.success(t('write.timeline.undone'))
    },
  })
  const busy = restoreMutation.isPending || undoMutation.isPending

  const restore = async (row: TimelineCheckpoint) => {
    const confirmed = await confirmDialog({
      confirmText: t('write.timeline.restore'),
      description: t('write.timeline.restoreDescription'),
      title: t('write.timeline.restoreTitle'),
    })
    if (confirmed) restoreMutation.mutate(row.id)
  }

  const shareKey = adminQueryKeys.drafts.share(documentId ?? '')
  const shareQuery = useQuery({
    enabled: Boolean(documentId),
    queryFn: () => getDraftShare(documentId!),
    queryKey: shareKey,
  })
  const writeShare = (share: DraftShare | null) => {
    queryClient.setQueryData(shareKey, share)
  }
  const setShareMutation = useMutation({
    mutationFn: (data: SetDraftShareData) => setDraftShare(documentId!, data),
    onSuccess: writeShare,
  })
  const revokeShareMutation = useMutation({
    mutationFn: () => deleteDraftShare(documentId!),
    onSuccess: () => {
      writeShare(null)
      toast.success(t('write.share.revoked'))
    },
  })
  const followDraft = () => setShareMutation.mutate({ draftId, mode: 'follow' })

  return (
    <AsidePanel
      icon={History}
      onClose={props.onClose}
      title={t('write.timeline.title')}
    >
      {documentId ? <CollaboratorsSection documentId={documentId} /> : null}
      {documentId ? (
        <ShareBar
          canFollowCurrentDraft
          onCreate={followDraft}
          onFollowCurrentDraft={followDraft}
          onRevoke={() => revokeShareMutation.mutate()}
          pending={setShareMutation.isPending || revokeShareMutation.isPending}
          share={shareQuery.data ?? null}
        />
      ) : null}
      {historyQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState
            description={t('write.timeline.emptyDescription')}
            icon={History}
            title={t('write.timeline.emptyTitle')}
          />
        </div>
      ) : (
        <Scroll className="min-h-0 flex-1" innerClassName="px-3 py-3">
          <ol className="flex flex-col">
            {rows.map((row) => (
              <TimelineItem
                busy={busy}
                authorName={
                  row.type === 'step' && row.author
                    ? (authorNames.get(row.author) ??
                      t('write.collaborators.unknownAuthor'))
                    : null
                }
                key={rowKey(row)}
                onRestore={() => void restore(row as TimelineCheckpoint)}
                onUndo={() => undoMutation.mutate(row as TimelineStep)}
                row={row}
                time={format.relativeTime(row.time)}
              />
            ))}
          </ol>
        </Scroll>
      )}
    </AsidePanel>
  )
}

const rowKey = (row: TimelineRow) =>
  row.type === 'checkpoint'
    ? `checkpoint:${row.id}`
    : `step:${row.change.peer}:${row.change.counter}`

function TimelineItem(props: {
  authorName: string | null
  busy: boolean
  onRestore: () => void
  onUndo: () => void
  row: TimelineRow
  time: string
}) {
  const { t } = useI18n()
  const { row } = props

  if (row.type === 'checkpoint') {
    return (
      <li className="group flex items-start gap-2 rounded-md px-2 py-2 hover:bg-surface-inset">
        <span
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            row.published ? 'bg-accent' : 'bg-fg-subtle',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-fg">
            <span className="truncate">
              {t(checkpointLabels[row.kind ?? 'legacy'])}
            </span>
            {row.published ? (
              <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-xs text-accent">
                {t('write.timeline.published')}
              </span>
            ) : null}
          </div>
          <div className="truncate text-xs text-fg-muted">
            {row.title || t('write.editor.untitled')} · {props.time}
          </div>
        </div>
        <Button
          aria-label={t('write.timeline.restore')}
          className="h-7 shrink-0 px-2 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          disabled={props.busy}
          onClick={props.onRestore}
          title={t('write.timeline.restore')}
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
        </Button>
      </li>
    )
  }

  const summary =
    row.kind === 'agent' ? row.message.replace(/^agent:?\s*/, '') : ''
  return (
    <li className="group flex items-start gap-2 rounded-md py-1.5 pr-2 pl-6 hover:bg-surface-inset">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-fg-muted">
          {props.authorName
            ? t('write.timeline.step.coauthor', {
                count: row.count,
                name: props.authorName,
              })
            : t(stepLabels[row.kind], { count: row.count, summary })}
        </div>
        <div className="text-xs text-fg-subtle">{props.time}</div>
      </div>
      {row.undoable ? (
        <Button
          aria-label={t('write.timeline.undo')}
          className="h-7 shrink-0 px-2 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          disabled={props.busy}
          onClick={props.onUndo}
          title={t('write.timeline.undo')}
          type="button"
          variant="ghost"
        >
          <Undo2 aria-hidden="true" className="size-3.5" />
        </Button>
      ) : null}
    </li>
  )
}
