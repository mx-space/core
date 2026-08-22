import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ScanSearch,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { OrphanFile } from '~/api/files'
import {
  batchDeleteOrphanFiles,
  cleanupOrphanFiles,
  reconcileFileReferences,
} from '~/api/files'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import type { ListAction } from '~/ui/list-actions'
import { useListKeyboard } from '~/ui/list-actions'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { FILES_PAGE_SIZE, filesQueryKey } from '../constants'
import { useFileSearch } from '../hooks/useFileSearch'
import { useOrphanFilesList } from '../hooks/useOrphanFilesList'
import type { FileRowItem } from '../utils/adapters'
import { adaptOrphanFile } from '../utils/adapters'
import { getErrorMessage } from '../utils/format'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileListEmpty } from './FileListEmpty'
import { FileListRow } from './FileListRow'
import { FileListSkeleton } from './FileListSkeleton'
import { FilePreviewLightbox } from './FilePreviewLightbox'
import { OrphanFilesRouteContext } from './orphan-files-route-context'
import {
  ReferenceReconcilePreview,
  runReferenceReconcileFlow,
} from './ReferenceReconcilePreview'
import { SearchRow } from './SearchRow'

const FOCUS_SCOPE_ID = 'orphan-files-list'

export function OrphanFilesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const { orphans, orphansQuery, page, pageCount, setPage, total } =
    useOrphanFilesList()
  const [searchQuery, setSearchQuery] = useState('')
  const [preview, setPreview] = useState<null | { name: string; url: string }>(
    null,
  )
  const [selectAllAcross, setSelectAllAcross] = useState(false)
  const [reconcileFlowActive, setReconcileFlowActive] = useState(false)
  const selectionClearRef = useRef<(() => void) | null>(null)

  const adapted = useMemo(
    () => orphans.map((item) => adaptOrphanFile(item, t)),
    [orphans, t],
  )
  const fileSearch = useFileSearch(adapted)
  const filtered = fileSearch.items

  useEffect(() => {
    if (fileSearch.query !== searchQuery) fileSearch.setQuery(searchQuery)
  }, [searchQuery])

  const buildListPath = useCallback(() => {
    const sp = new URLSearchParams()
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    return `/files/orphans${qs ? `?${qs}` : ''}`
  }, [page])

  const closeDetail = useCallback(() => {
    navigate(buildListPath())
  }, [buildListPath, navigate])

  const openItem = useCallback(
    (item: FileRowItem<OrphanFile>) => {
      const sp = new URLSearchParams()
      if (page > 1) sp.set('page', String(page))
      const qs = sp.toString()
      navigate(
        `/files/orphans/${encodeURIComponent(item.id)}${qs ? `?${qs}` : ''}`,
      )
    },
    [navigate, page],
  )

  const deleteMutation = useMutation({
    mutationFn: (item: OrphanFile) =>
      batchDeleteOrphanFiles({ ids: [item.id] }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('files.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('files.toast.orphanDeleted'))
      closeDetail()
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: () => cleanupOrphanFiles(60),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('files.toast.cleanupFailed'))),
    onSuccess: async (result) => {
      toast.success(
        t('files.toast.orphansCleaned', { count: result.deletedCount }),
      )
      setPage(1)
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (input: { all: true } | { ids: string[] }) =>
      batchDeleteOrphanFiles(input),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('files.toast.batchDeleteFailed'))),
    onSuccess: async (result) => {
      toast.success(
        t('files.toast.orphansDeleted', { count: result.deletedCount }),
      )
      selectionClearRef.current?.()
      setSelectAllAcross(false)
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const reconcileMutation = useMutation({
    mutationFn: (apply: boolean) => reconcileFileReferences(apply),
  })

  const confirmAndDelete = useCallback(
    async (item: FileRowItem<OrphanFile>) => {
      const ok = await confirmDialog({
        destructive: true,
        title: t('files.confirmDeleteNamed', { name: item.name }),
      })
      if (!ok) return
      deleteMutation.mutate(item.raw)
    },
    [deleteMutation, t],
  )

  const actions = useMemo<ListAction<FileRowItem<OrphanFile>>[]>(
    () => [
      {
        key: 'open',
        label: t('files.action.open'),
        run: (targets) => openItem(targets[0]),
        shortcut: 'Enter',
        shortcutLabel: '↵',
      },
      {
        danger: true,
        key: 'delete',
        label: t('common.delete'),
        run: (targets) => void confirmAndDelete(targets[0]),
        shortcut: 'Backspace',
        shortcutLabel: '⌫',
      },
    ],
    [t, openItem, confirmAndDelete],
  )

  const { selection } = useListKeyboard<FileRowItem<OrphanFile>>({
    actions,
    getId: (item) => item.id,
    items: filtered,
    onBeforeSelectionReset: () => setSelectAllAcross(false),
    onItemFocus: (id) => {
      const item = filtered.find((entry) => entry.id === id)
      if (item) openItem(item)
    },
    resetOn: [page, searchQuery],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear

  const selectedCount = selection.size
  const visibleIds = filtered.map((item) => item.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))
  const indeterminate = selectedCount > 0 && !allVisibleSelected

  const confirmBatchDelete = async () => {
    const scope = selectAllAcross
      ? t('files.orphans.scope.all', { count: total })
      : t('files.orphans.scope.selected', { count: selectedCount })
    const ok = await confirmDialog({
      destructive: true,
      title: t('files.orphans.confirmBatchDelete', { scope }),
    })
    if (!ok) return
    batchDeleteMutation.mutate(
      selectAllAcross
        ? { all: true }
        : { ids: selection.getSelectedTargets().map((item) => item.id) },
    )
  }

  const confirmCleanup = async () => {
    const ok = await confirmDialog({
      destructive: true,
      title: t('files.orphans.confirmCleanup'),
    })
    if (!ok) return
    cleanupMutation.mutate()
  }

  const reconcileReferences = async () => {
    if (reconcileFlowActive) return
    setReconcileFlowActive(true)
    try {
      const appliedResult = await runReferenceReconcileFlow({
        confirm: (previewResult) =>
          confirmDialog({
            confirmText: t('files.orphans.reconcileApply'),
            description: <ReferenceReconcilePreview result={previewResult} />,
            title: t('files.orphans.reconcileConfirm'),
          }),
        onUpToDate: async () => {
          toast.success(t('files.toast.referencesUpToDate'))
          setPage(1)
          await queryClient.invalidateQueries({ queryKey: filesQueryKey })
        },
        scan: (apply) => reconcileMutation.mutateAsync(apply),
      })
      if (!appliedResult) return
      toast.success(
        t('files.toast.referencesReconciled', {
          active: appliedResult.referencedFiles,
          isolated: appliedResult.isolatedFiles,
          usages: appliedResult.usages,
        }),
      )
      setPage(1)
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    } catch (error) {
      toast.error(
        getErrorMessage(error, t('files.toast.referencesReconcileFailed')),
      )
    } finally {
      setReconcileFlowActive(false)
    }
  }

  const refreshing = orphansQuery.isFetching
  const maintenanceBusy =
    reconcileFlowActive || cleanupMutation.isPending || refreshing
  const hasSelection = selectedCount > 0 || selectAllAcross

  const ctxValue = useMemo(
    () => ({
      page,
      deleteDisabled: deleteMutation.isPending,
      onBack: closeDetail,
      onDelete: (item: FileRowItem<OrphanFile>) => void confirmAndDelete(item),
      onOpenPreview: (next: { name: string; url: string }) => setPreview(next),
    }),
    [page, deleteMutation.isPending, closeDetail, confirmAndDelete],
  )

  return (
    <OrphanFilesRouteContext.Provider value={ctxValue}>
      <MasterDetailShell
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
        emptyDetail={<FileDetailEmpty />}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <header
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-page px-4',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="flex min-w-0 items-baseline gap-2 text-base font-semibold text-fg">
                  <span className="truncate">{t('files.source.orphans')}</span>
                  <span className="text-xs font-normal tabular-nums text-fg-muted">
                    {total}
                  </span>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={t('files.action.refresh')}
                  disabled={maintenanceBusy}
                  iconOnly
                  onClick={() => void orphansQuery.refetch()}
                  title={t('files.action.refresh')}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn('size-4', refreshing && 'animate-spin')}
                  />
                </Button>
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    aria-label={t('files.orphans.maintenance')}
                    className="inline-flex size-10 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[popup-open]:bg-surface-inset"
                    title={t('files.orphans.maintenance')}
                    type="button"
                  >
                    <MoreHorizontal aria-hidden="true" className="size-4" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" className="w-56">
                    <DropdownMenu.Item
                      disabled={maintenanceBusy}
                      onClick={() => void reconcileReferences()}
                    >
                      {reconcileFlowActive ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <ScanSearch aria-hidden="true" className="size-4" />
                      )}
                      <span>{t('files.orphans.reconcile')}</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                      danger
                      disabled={maintenanceBusy}
                      onClick={() => void confirmCleanup()}
                    >
                      {cleanupMutation.isPending ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <Trash2 aria-hidden="true" className="size-4" />
                      )}
                      <span>{t('files.orphans.cleanup')}</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </div>
            </header>

            <SearchRow
              onChange={setSearchQuery}
              placeholder={t('files.search.placeholder')}
              value={searchQuery}
            />

            {filtered.length > 0 ? (
              <div
                className="grid min-h-12 shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-1 border-b border-border bg-surface-inset px-2 py-1 text-xs"
                data-testid="orphan-files-selection-bar"
              >
                <label
                  aria-label={t('files.orphans.selectCurrentPage')}
                  className="inline-flex size-10 cursor-pointer items-center justify-center"
                  title={t('files.orphans.selectCurrentPage')}
                >
                  <Checkbox
                    aria-label={t('files.orphans.selectCurrentPage')}
                    checked={allVisibleSelected || selectAllAcross}
                    indeterminate={indeterminate}
                    onCheckedChange={(checked) => {
                      setSelectAllAcross(false)
                      if (checked) selection.selectAll()
                      else selection.clear()
                    }}
                  />
                </label>
                <span className="min-w-0 truncate whitespace-nowrap tabular-nums text-fg-muted">
                  {selectAllAcross
                    ? t('files.orphans.allSelected', { count: total })
                    : selectedCount > 0
                      ? t('files.orphans.selectedCount', {
                          count: selectedCount,
                        })
                      : t('files.orphans.selectCurrentPage')}
                </span>
                <button
                  aria-hidden={!hasSelection}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-1 rounded px-2 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40',
                    !hasSelection && 'pointer-events-none invisible',
                  )}
                  disabled={!hasSelection || batchDeleteMutation.isPending}
                  onClick={() => void confirmBatchDelete()}
                  tabIndex={hasSelection ? undefined : -1}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  <span className="whitespace-nowrap tabular-nums">
                    {selectAllAcross
                      ? t('files.orphans.deleteAll', { count: total })
                      : t('files.orphans.deleteSelected', {
                          count: selectedCount,
                        })}
                  </span>
                </button>
                {allVisibleSelected && pageCount > 1 && !selectAllAcross ? (
                  <button
                    className="col-start-2 col-end-4 inline-flex min-h-10 min-w-0 items-center self-stretch text-left leading-tight text-fg underline-offset-2 hover:underline"
                    onClick={() => setSelectAllAcross(true)}
                    type="button"
                  >
                    {t('files.orphans.selectEvery', { count: total })}
                  </button>
                ) : null}
                {selectAllAcross ? (
                  <button
                    className="col-start-2 col-end-4 inline-flex min-h-10 min-w-0 items-center self-stretch text-left leading-tight text-fg underline-offset-2 hover:underline"
                    onClick={() => {
                      setSelectAllAcross(false)
                      selection.clear()
                    }}
                    type="button"
                  >
                    {t('files.orphans.deselectAll')}
                  </button>
                ) : null}
              </div>
            ) : null}

            <Scroll className="flex-1">
              {orphansQuery.isLoading && adapted.length === 0 ? (
                <FileListSkeleton />
              ) : filtered.length === 0 ? (
                <FileListEmpty
                  action={
                    searchQuery ? undefined : (
                      <Button
                        disabled={maintenanceBusy}
                        onClick={() => void reconcileReferences()}
                        type="button"
                        variant="secondary"
                      >
                        {reconcileFlowActive ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                          />
                        ) : (
                          <ScanSearch aria-hidden="true" className="size-4" />
                        )}
                        {t('files.orphans.reconcile')}
                      </Button>
                    )
                  }
                  hint={t('files.orphans.cleanupNote')}
                  label={
                    searchQuery
                      ? t('files.search.noMatches')
                      : t('files.empty.orphans')
                  }
                />
              ) : (
                filtered.map((item) => (
                  <FileListRow<OrphanFile>
                    actions={actions}
                    checked={selectAllAcross || selection.isSelected(item.id)}
                    cursor={selection.isCursor(item.id)}
                    isDetailTarget={detailId === item.id}
                    item={item}
                    key={item.id}
                    onCheck={(_id, checked) => {
                      setSelectAllAcross(false)
                      if (checked) selection.toggleWithAnchor(item.id)
                      else selection.toggle(item.id)
                    }}
                    onSelect={(mode) => {
                      if (mode === 'range') selection.selectRange(item.id)
                      else if (mode === 'toggle')
                        selection.toggleWithAnchor(item.id)
                      else {
                        selection.setCursor(item.id)
                        openItem(item)
                      }
                    }}
                    selectable
                    selected={selection.isSelected(item.id)}
                  />
                ))
              )}
            </Scroll>

            {pageCount > 1 ? (
              <div className="flex shrink-0 items-center justify-end border-t border-border px-4 py-2">
                <CompactPagination
                  onPageChange={setPage}
                  onPageSizeChange={() => undefined}
                  page={page}
                  pageCount={pageCount}
                  pageSize={FILES_PAGE_SIZE}
                  pageSizes={[FILES_PAGE_SIZE]}
                />
              </div>
            ) : null}
          </FocusScope>
        }
      />
      <FilePreviewLightbox image={preview} onClose={() => setPreview(null)} />
    </OrphanFilesRouteContext.Provider>
  )
}
