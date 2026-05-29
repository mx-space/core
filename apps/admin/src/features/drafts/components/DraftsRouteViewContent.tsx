import { Menu } from '@base-ui/react/menu'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { DraftModel, DraftRefType } from '~/models/draft'

import { deleteDraft, getDrafts } from '~/api/drafts'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { menuStyles } from '~/ui/overlay/menu-styles'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { draftsQueryKey, filterOptionKeys } from '../constants'
import { parseDraftFilterType } from '../utils/draft-filter'
import { getErrorMessage } from '../utils/errors'
import { buildDraftActions } from './buildDraftActions'
import { DraftDetail } from './DraftDetail'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { DraftListEmpty } from './DraftListEmpty'
import { DraftListSkeleton } from './DraftListSkeleton'
import { DraftRow } from './DraftRow'

const FOCUS_SCOPE_ID = 'drafts-list'

export function DraftsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const initialType = parseDraftFilterType(searchParams.get('type'))
  const [filterType, setFilterType] = useState<DraftRefType | 'all'>(
    initialType,
  )
  const [detailId, setDetailId] = useState<string | null>(
    searchParams.get('id'),
  )
  const [selectedDraftSnapshot, setSelectedDraftSnapshot] =
    useState<DraftModel | null>(null)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)

  const draftsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getDrafts({
        page: 1,
        refType: filterType === 'all' ? undefined : filterType,
        size: 50,
      }),
    queryKey: [...draftsQueryKey, 'list', filterType],
  })

  const drafts = draftsQuery.data?.data ?? []
  const selectedDraft = useMemo(() => {
    if (!detailId) return null
    const fromList = drafts.find((draft) => draft.id === detailId)
    if (fromList) return fromList
    if (selectedDraftSnapshot?.id === detailId) return selectedDraftSnapshot
    return null
  }, [drafts, selectedDraftSnapshot, detailId])

  useLayoutEffect(() => {
    const nextType = parseDraftFilterType(searchParams.get('type'))
    const nextDetailId = searchParams.get('id')

    setFilterType((value) => (value === nextType ? value : nextType))
    setDetailId((value) => (value === nextDetailId ? value : nextDetailId))
    setShowDetailOnMobile(Boolean(nextDetailId))
    if (!nextDetailId) setSelectedDraftSnapshot(null)
  }, [searchParamsKey])

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams)

    if (filterType === 'all') {
      nextParams.delete('type')
    } else {
      nextParams.set('type', filterType)
    }

    if (detailId) {
      nextParams.set('id', detailId)
    } else {
      nextParams.delete('id')
    }

    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [filterType, searchParams, searchParamsKey, detailId, setSearchParams])

  const selectionClearRef = useRef<(() => void) | null>(null)

  const invalidateDrafts = async () => {
    await queryClient.invalidateQueries({ queryKey: draftsQueryKey })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteDraft,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('drafts.toast.deleted'))
      setDetailId(null)
      setSelectedDraftSnapshot(null)
      setShowDetailOnMobile(false)
      selectionClearRef.current?.()
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
      setDetailId(null)
      setSelectedDraftSnapshot(null)
      setShowDetailOnMobile(false)
      if (failedCount > 0) {
        toast.warning(`${successCount}/${successCount + failedCount}`)
      } else {
        toast.success(t('drafts.toast.deleted'))
      }
      await invalidateDrafts()
    },
  })

  const openDraft = (draft: DraftModel) => {
    setDetailId(draft.id)
    setSelectedDraftSnapshot({ ...draft })
    setShowDetailOnMobile(true)
  }

  const confirmAndDelete = async (targets: DraftModel[]) => {
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
  }

  const actions = useMemo(
    () =>
      buildDraftActions(
        {
          deleteMany: confirmAndDelete,
          open: openDraft,
        },
        t,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleFilterChange = (value: DraftRefType | 'all') => {
    setFilterType(value)
    setDetailId(null)
    setSelectedDraftSnapshot(null)
    setShowDetailOnMobile(false)
  }

  const selectedCount = selection.size
  const visibleIds = drafts.map((d) => d.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))
  const indeterminate = selectedCount > 0 && !allVisibleSelected

  return (
    <MasterDetailLayout
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
            <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              <span className="truncate">{t('drafts.title')}</span>
              <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                {draftsQuery.data?.pagination.total ?? 0}
              </span>
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              <Menu.Root>
                <Menu.Trigger
                  aria-label={t('drafts.newPost')}
                  className="outline-hidden inline-flex h-9 items-center gap-1.5 rounded px-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] dark:text-neutral-200 dark:hover:bg-neutral-800"
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {t('common.add')}
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner align="end" side="bottom" sideOffset={6}>
                    <Menu.Popup className={menuStyles.popup}>
                      <Menu.Item
                        className={menuStyles.item}
                        render={<Link to="/posts/edit" />}
                      >
                        {t('drafts.newPost')}
                      </Menu.Item>
                      <Menu.Item
                        className={menuStyles.item}
                        render={<Link to="/notes/edit" />}
                      >
                        {t('drafts.newNote')}
                      </Menu.Item>
                      <Menu.Item
                        className={menuStyles.item}
                        render={<Link to="/pages/edit" />}
                      >
                        {t('drafts.newPage')}
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
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
                onClick={() => handleFilterChange(option.value)}
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
                disabled={selectedCount === 0 || batchDeleteMutation.isPending}
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
      showDetailOnMobile={showDetailOnMobile}
      detail={
        <section className="h-full min-h-0">
          {selectedDraft ? (
            <DraftDetail
              deleting={deleteMutation.isPending}
              draft={selectedDraft}
              onBack={() => setShowDetailOnMobile(false)}
              onDelete={(draft) => {
                void confirmAndDelete([draft])
              }}
            />
          ) : (
            <DraftDetailEmpty />
          )}
        </section>
      }
    />
  )
}
