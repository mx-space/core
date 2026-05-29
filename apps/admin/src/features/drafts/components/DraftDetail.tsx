import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, GitCompare, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import {
  getDraftHistory,
  getDraftHistoryVersion,
  restoreDraftVersion,
} from '~/api/drafts'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { DraftModel } from '~/models/draft'
import { FocusScope, useScopeArrowNav } from '~/ui/focus-scope'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { draftsQueryKey, refTypeMeta } from '../constants'
import { buildVersionItems, computeDiffStats } from '../utils/draft-diff'
import { getEditPathForDraft } from '../utils/draft-edit-path'
import { getErrorMessage } from '../utils/errors'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { DraftDiffPreview } from './DraftDiffPreview'
import { VersionRow } from './VersionRow'

export function DraftDetail(props: {
  deleting: boolean
  draft: DraftModel
  onBack: () => void
  onDelete: (draft: DraftModel) => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const historyQuery = useQuery({
    enabled: Boolean(props.draft.id),
    queryFn: () => getDraftHistory(props.draft.id),
    queryKey: [...draftsQueryKey, 'history', props.draft.id],
  })
  const meta = refTypeMeta[props.draft.refType]
  const editPath = getEditPathForDraft(props.draft)
  const versionItems = useMemo(
    () => buildVersionItems(props.draft, historyQuery.data),
    [historyQuery.data, props.draft],
  )
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const versionsScopeId = `draft-versions-${props.draft.id}`

  useScopeArrowNav({
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (el) => {
      const id = el.getAttribute('data-id')
      if (id) setSelectedVersion(Number(id))
    },
    scopeId: versionsScopeId,
  })

  useEffect(() => {
    const previousVersion = versionItems.find((item) => !item.isCurrent)
    setSelectedVersion(previousVersion?.version ?? null)
  }, [props.draft.id, versionItems])

  const selectedVersionItem = versionItems.find(
    (item) => item.version === selectedVersion,
  )
  const selectedVersionQuery = useQuery({
    enabled: selectedVersion != null && selectedVersion !== props.draft.version,
    queryFn: () => getDraftHistoryVersion(props.draft.id, selectedVersion!),
    queryKey: [
      ...draftsQueryKey,
      'history-version',
      props.draft.id,
      selectedVersion,
    ],
  })
  const selectedVersionDraft =
    selectedVersion === props.draft.version
      ? props.draft
      : selectedVersionQuery.data
  const diffStats =
    selectedVersionDraft && selectedVersion !== null
      ? computeDiffStats(selectedVersionDraft, props.draft)
      : null
  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      restoreDraftVersion(props.draft.id, version),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.history.restoreFailed'))),
    onSuccess: async () => {
      toast.success(t('drafts.history.restoreSuccess'))
      await queryClient.invalidateQueries({ queryKey: draftsQueryKey })
    },
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
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
            <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {props.draft.title || t('drafts.row.untitled')}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{t(meta.labelKey)}</span>
              <span>v{props.draft.version}</span>
              <time dateTime={props.draft.updatedAt}>
                {relativeTimeFromNow(props.draft.updatedAt)}
              </time>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            className="h-8 px-2.5"
            onClick={() => navigate(editPath)}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-4" />
            {t('drafts.detail.edit')}
          </Button>
          <Button
            className="h-8 border-red-200 px-2.5 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
            disabled={props.deleting}
            onClick={() => props.onDelete(props.draft)}
            type="button"
            variant="subtle"
          >
            {props.deleting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            {t('drafts.detail.delete')}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {historyQuery.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2
              aria-hidden="true"
              className="size-5 animate-spin text-neutral-400"
            />
          </div>
        ) : versionItems.length === 0 ? (
          <DraftDetailEmpty />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
            <FocusScope
              className="outline-hidden min-h-0 border-b border-neutral-200 lg:border-b-0 lg:border-r dark:border-neutral-800"
              id={versionsScopeId}
            >
              <div className="flex h-10 items-center gap-2 border-b border-neutral-200 px-4 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                <GitCompare aria-hidden="true" className="size-4" />
                {t('drafts.history.title')}
                <span className="text-xs font-normal text-neutral-400">
                  ({versionItems.length})
                </span>
              </div>
              <Scroll className="max-h-72 lg:h-[calc(100%-2.5rem)] lg:max-h-none">
                {versionItems.map((item) => (
                  <VersionRow
                    diffStats={
                      item.version === selectedVersion ? diffStats : null
                    }
                    item={item}
                    key={item.version}
                    onRestore={() => restoreMutation.mutate(item.version)}
                    onSelect={() => setSelectedVersion(item.version)}
                    restorePending={restoreMutation.isPending}
                    selected={selectedVersion === item.version}
                  />
                ))}
              </Scroll>
            </FocusScope>

            <div className="flex min-h-0 flex-col bg-neutral-50 dark:bg-neutral-950">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {selectedVersionItem ? (
                    <>
                      <span>v{selectedVersionItem.version}</span>
                      <span className="text-neutral-400">→</span>
                      <span>
                        {t('drafts.history.current', {
                          version: props.draft.version,
                        })}
                      </span>
                    </>
                  ) : (
                    <span>{t('drafts.history.pickVersion')}</span>
                  )}
                </div>
                {diffStats && !diffStats.isSame ? (
                  <span className="text-xs tabular-nums text-neutral-500">
                    {t('drafts.history.deltaChars', {
                      delta:
                        diffStats.delta > 0
                          ? `+${diffStats.delta}`
                          : diffStats.delta,
                    })}
                  </span>
                ) : null}
              </div>

              <Scroll className="flex-1" innerClassName="p-4">
                {selectedVersionQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2
                      aria-hidden="true"
                      className="size-5 animate-spin text-neutral-400"
                    />
                  </div>
                ) : selectedVersionDraft ? (
                  <DraftDiffPreview
                    currentDraft={props.draft}
                    diffStats={diffStats}
                    selectedDraft={selectedVersionDraft}
                  />
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('drafts.history.cannotLoad')}
                  </p>
                )}
              </Scroll>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
