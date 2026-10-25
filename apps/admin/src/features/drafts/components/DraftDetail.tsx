import { useMutation, useQuery } from '@tanstack/react-query'
import { Archive, ChevronLeft, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
  getCompactPreview,
  getDraftRevisions,
  restoreDraftRevision,
} from '~/api/drafts'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { DraftCard, DraftModel } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { refTypeMeta } from '../constants'
import { buildVersionItems, computeDiffStats } from '../utils/draft-diff'
import {
  getEditPathForDraft,
  getEditPathForRevision,
} from '../utils/draft-edit-path'
import type { DraftCompareView } from './DraftCompareBar'
import { DraftCompareBar } from './DraftCompareBar'
import { openDraftCompareDialog } from './DraftCompareDialog'
import { DraftDiffPreview } from './DraftDiffPreview'

export function DraftDetail(props: {
  busy: boolean
  card: DraftCard
  draft: DraftModel
  onBack: () => void
  onCompact: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const revisionsQuery = useQuery({
    enabled: Boolean(props.draft.id),
    queryFn: () => getDraftRevisions(props.draft.id),
    queryKey: adminQueryKeys.drafts.history(props.draft.id),
  })
  const compactQuery = useQuery({
    queryFn: () => getCompactPreview(props.draft.id),
    queryKey: adminQueryKeys.drafts.compactPreview(props.draft.id),
  })
  const doomed = useMemo(
    () => new Set(compactQuery.data?.revisionIds ?? []),
    [compactQuery.data],
  )
  const meta = refTypeMeta[props.draft.document.refType]
  const versionItems = useMemo(
    () => buildVersionItems(props.draft.headRevisionId, revisionsQuery.data),
    [props.draft.headRevisionId, revisionsQuery.data],
  )
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null,
  )
  const versionsScopeId = `draft-versions-${props.draft.id}`
  const restoresInPlace = props.draft.headRevision.contentFormat === 'lexical'
  const restoreMutation = useMutation({
    mutationFn: (revisionId: string) =>
      restoreDraftRevision(props.draft.id, revisionId),
    onError: () => toast.error(t('write.timeline.failed')),
    onSuccess: (draft) => navigate(getEditPathForDraft(draft)),
  })

  const [view, setView] = useState<DraftCompareView>('changes')
  const restore = (revisionId: string) =>
    restoresInPlace
      ? restoreMutation.mutate(revisionId)
      : navigate(getEditPathForRevision(props.draft, revisionId))

  useEffect(() => {
    setSelectedRevisionId(
      versionItems.find((item) => !item.isCurrent)?.id ?? null,
    )
  }, [props.draft.id, versionItems])

  const selectedItem = versionItems.find(
    (item) => item.id === selectedRevisionId,
  )
  const selectedRevision = revisionsQuery.data?.find(
    (revision) => revision.id === selectedRevisionId,
  )
  const diffStats = selectedRevision
    ? computeDiffStats(selectedRevision, props.draft.headRevision)
    : null
  const { storage } = props.card
  const reclaim = compactQuery.data
    ? compactQuery.data.revisionBytes + compactQuery.data.crdtBytes
    : 0
  const summary = [
    t(meta.labelKey),
    relativeTimeFromNow(props.draft.updatedAt ?? props.draft.createdAt),
    `${t('drafts.storage.revisions')} ${t(
      'drafts.storagePanel.revisionsValue',
      {
        count: storage.revisionCount,
        size: formatBytes(storage.revisionBytes),
      },
    )}`,
    storage.crdtBytes > 0
      ? `${t('drafts.storage.crdt')} ${formatBytes(storage.crdtBytes)}`
      : null,
  ].filter(Boolean)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-border px-6',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <MobileHeaderAffordance />
          <Button
            aria-label={t('drafts.detail.backAria')}
            className="h-8 px-2 lg:hidden"
            onClick={props.onBack}
            type="button"
            variant="subtle"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-fg">
              {props.draft.headRevision.title || t('drafts.row.untitled')}
            </h2>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {summary.join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            className="h-8 px-2.5"
            disabled={props.busy || !compactQuery.data || reclaim === 0}
            onClick={props.onCompact}
            type="button"
            variant="subtle"
          >
            {props.busy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Archive aria-hidden="true" className="size-4" />
            )}
            {reclaim > 0
              ? t('drafts.compact.actionWithSize', {
                  size: formatBytes(reclaim),
                })
              : t('drafts.compact.action')}
          </Button>
          <Button
            className="h-8 px-2.5"
            onClick={() => navigate(getEditPathForDraft(props.draft))}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-4" />
            {t('drafts.detail.edit')}
          </Button>
          <Button
            className="h-8 border-red-200 px-2.5 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
            disabled={props.busy}
            onClick={props.onDelete}
            type="button"
            variant="subtle"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t('drafts.detail.delete')}
          </Button>
        </div>
      </div>

      {revisionsQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-fg-subtle" />
        </div>
      ) : revisionsQuery.isError ? (
        <p className="px-6 py-8 text-center text-sm text-fg-muted">
          {t('drafts.history.cannotLoad')}
        </p>
      ) : versionItems.length <= 1 ? (
        <p className="px-6 py-8 text-center text-sm text-fg-muted">
          {t('drafts.history.noEarlier')}
        </p>
      ) : (
        <>
          <DraftCompareBar
            diffStats={diffStats}
            doomed={doomed}
            items={versionItems}
            onOpenSplit={() => {
              if (!selectedRevision || !selectedItem) return
              void openDraftCompareDialog({
                currentDraft: props.draft.headRevision,
                diffStats,
                onRestore: () => restore(selectedItem.id),
                savedAt: selectedItem.savedAt,
                selectedDraft: selectedRevision,
                title:
                  props.draft.headRevision.title || t('drafts.row.untitled'),
              })
            }}
            onRestore={restore}
            onSelect={setSelectedRevisionId}
            onViewChange={setView}
            restorePendingId={
              restoreMutation.isPending
                ? (restoreMutation.variables ?? null)
                : null
            }
            scopeId={versionsScopeId}
            selectedId={selectedRevisionId}
            view={view}
          />
          <Scroll className="min-h-0 flex-1" innerClassName="px-6 py-6">
            <div className="mx-auto max-w-3xl">
              {selectedRevision ? (
                <DraftDiffPreview
                  collapseUnchanged={view === 'changes'}
                  currentDraft={props.draft.headRevision}
                  diffStats={diffStats}
                  layout="inline"
                  selectedDraft={selectedRevision}
                />
              ) : (
                <p className="text-sm text-fg-muted">
                  {t('drafts.history.cannotLoad')}
                </p>
              )}
            </div>
          </Scroll>
        </>
      )}
    </div>
  )
}
