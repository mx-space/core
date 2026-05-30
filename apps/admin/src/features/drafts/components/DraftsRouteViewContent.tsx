import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { deleteDraft, getDrafts } from '~/api/drafts'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { DraftModel, DraftRefType } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { draftsQueryKey, filterOptionKeys } from '../constants'
import { parseDraftFilterType } from '../utils/draft-filter'
import { getErrorMessage } from '../utils/errors'
import { buildDraftActions } from './buildDraftActions'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { DraftListEmpty } from './DraftListEmpty'
import { DraftListSkeleton } from './DraftListSkeleton'
import { DraftRow } from './DraftRow'
import { DraftsRouteContext } from './drafts-route-context'

const FOCUS_SCOPE_ID = 'drafts-list'

export function DraftsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const [searchParams] = useSearchParams()
  const filterType = parseDraftFilterType(searchParams.get('type'))

  const setFilter = useCallback(
    (next: DraftRefType | 'all') => {
      const sp = new URLSearchParams(searchParams)
      if (next === 'all') sp.delete('type')
      else sp.set('type', next)
      const qs = sp.toString()
      // Filter change closes detail and resets to list root.
      navigate(`/drafts${qs ? `?${qs}` : ''}`, { replace: true })
    },
    [navigate, searchParams],
  )

  const draftsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getDrafts({
        page: 1,
        refType: filterType === 'all' ? undefined : filterType,
        size: 50,
      }),
    queryKey: adminQueryKeys.drafts.list(filterType),
  })

  const drafts = draftsQuery.data?.data ?? []

  const selectionClearRef = useRef<(() => void) | null>(null)

  const invalidateDrafts = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: draftsQueryKey })
  }, [queryClient])

  const closeDetail = useCallback(() => {
    const qs = searchParams.toString()
    navigate(`/drafts${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams])

  const deleteMutation = useMutation({
    mutationFn: deleteDraft,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('drafts.toast.deleted'))
      selectionClearRef.current?.()
      closeDetail()
      await invalidateDrafts()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteDraft(id)))
      return {
        failedCount: results.filter((r) => r.status === 'rejected').length,
        successCount: results.filter((r) => r.status === 'fulfilled').length,
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.toast.deleteFailed'))),
    onSuccess: async ({ failedCount, successCount }) => {
      selectionClearRef.current?.()
      closeDetail()
      if (failedCount > 0) {
        toast.warning(`${successCount}/${successCount + failedCount}`)
      } else {
        toast.success(t('drafts.toast.deleted'))
      }
      await invalidateDrafts()
    },
  })

  const openDraft = useCallback(
    (draft: DraftModel) => {
      const qs = searchParams.toString()
      navigate(`/drafts/${draft.id}${qs ? `?${qs}` : ''}`)
    },
    [navigate, searchParams],
  )

  const confirmAndDelete = useCallback(
    async (targets: DraftModel[]) => {
      if (targets.length === 0) return
      const title =
        targets.length === 1
          ? t('drafts.detail.confirmDelete', {
              title: targets[0].title || t('drafts.row.untitled'),
            })
          : t('drafts.list.confirmBatchDelete', { count: targets.length })
      const confirmed = await confirmDialog({ destructive: true, title })
      if (!confirmed) return
      if (targets.length === 1) {
        deleteMutation.mutate(targets[0].id)
      } else {
        batchDeleteMutation.mutate(targets.map((target) => target.id))
      }
    },
    [batchDeleteMutation, deleteMutation, t],
  )

  const actions = useMemo(
    () =>
      buildDraftActions(
        {
          deleteMany: confirmAndDelete,
          open: openDraft,
        },
        t,
      ),
    [t],
  )

  const { selection } = useListKeyboard<DraftModel>({
    actions,
    getId: (draft) => draft.id,
    items: drafts,
    resetOn: [filterType],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear

  const selectedCount = selection.size
  const visibleIds = drafts.map((d) => d.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))
  const indeterminate = selectedCount > 0 && !allVisibleSelected

  const routeContextValue = useMemo(
    () => ({
      deleting: deleteMutation.isPending,
      onBack: closeDetail,
      onDelete: (draft: DraftModel) => {
        void confirmAndDelete([draft])
      },
    }),
    [closeDetail, confirmAndDelete, deleteMutation.isPending],
  )

  return (
    <DraftsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        emptyDetail={<DraftDetailEmpty />}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                  <span className="truncate">{t('drafts.title')}</span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {draftsQuery.data?.pagination.total ?? 0}
                  </span>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    aria-label={t('drafts.newPost')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[popup-open]:bg-surface-inset"
                    type="button"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    {t('common.add')}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item render={<Link to="/posts/edit" />}>
                      {t('drafts.newPost')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item render={<Link to="/notes/edit" />}>
                      {t('drafts.newNote')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item render={<Link to="/pages/edit" />}>
                      {t('drafts.newPage')}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
                <Button
                  aria-label={t('common.refresh')}
                  disabled={draftsQuery.isFetching}
                  iconOnly
                  onClick={() => void draftsQuery.refetch()}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      draftsQuery.isFetching && 'animate-spin',
                    )}
                  />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              {filterOptionKeys.map((option) => (
                <button
                  className={cn(
                    'rounded border px-2.5 py-1 text-xs transition-colors',
                    filterType === option.value
                      ? 'border-neutral-950 bg-neutral-950 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-950'
                      : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900',
                  )}
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  type="button"
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>

            {drafts.length > 0 ? (
              <div className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/60 px-4 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
                <Checkbox
                  aria-label={t('drafts.list.selectAllVisible')}
                  checked={allVisibleSelected}
                  indeterminate={indeterminate}
                  onCheckedChange={(checked) => {
                    if (checked) selection.selectAll()
                    else selection.clear()
                  }}
                />
                <span className="text-neutral-500 dark:text-neutral-400">
                  {selectedCount > 0
                    ? t('drafts.list.selectedCount', { count: selectedCount })
                    : t('drafts.list.selectAllVisible')}
                </span>
                <button
                  aria-hidden={selectedCount === 0}
                  className={cn(
                    'ml-auto inline-flex h-6 items-center gap-1 rounded px-2 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40',
                    selectedCount === 0 && 'pointer-events-none invisible',
                  )}
                  disabled={
                    selectedCount === 0 || batchDeleteMutation.isPending
                  }
                  onClick={() =>
                    void confirmAndDelete(selection.getSelectedTargets())
                  }
                  tabIndex={selectedCount === 0 ? -1 : undefined}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  {t('drafts.list.bulkDelete')}
                </button>
              </div>
            ) : null}

            <Scroll className="flex-1">
              {draftsQuery.isLoading && drafts.length === 0 ? (
                <DraftListSkeleton />
              ) : drafts.length === 0 ? (
                <DraftListEmpty />
              ) : (
                drafts.map((draft) => (
                  <DraftRow
                    actions={actions}
                    checked={selection.isSelected(draft.id)}
                    draft={draft}
                    isDetailTarget={detailId === draft.id}
                    key={draft.id}
                    onCheck={() => selection.toggleWithAnchor(draft.id)}
                    onSelect={(mode) => {
                      if (mode === 'range') selection.selectRange(draft.id)
                      else if (mode === 'toggle')
                        selection.toggleWithAnchor(draft.id)
                      else {
                        selection.selectOne(draft.id)
                        openDraft(draft)
                      }
                    }}
                    selected={selection.isSelected(draft.id)}
                  />
                ))
              )}
            </Scroll>
          </FocusScope>
        }
      />
    </DraftsRouteContext.Provider>
  )
}
