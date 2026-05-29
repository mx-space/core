import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { OrphanFile } from '~/api/files'
import {
  batchDeleteOrphanFiles,
  cleanupOrphanFiles,
  deleteFileByTypeAndName,
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
      deleteFileByTypeAndName('image', item.fileName),
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
        label: t('files.action.previewImage'),
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
    resetOn: [page, searchQuery],
    onItemFocus: (id) => {
      selection.selectOne(id)
    },
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

  const refreshing = orphansQuery.isFetching
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
        emptyDetail={<FileDetailEmpty />}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <header
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
                <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
                  <span className="truncate">{t('files.source.orphans')}</span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {total}
                  </span>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={t('files.orphans.cleanup')}
                  disabled={cleanupMutation.isPending}
                  onClick={() => void confirmCleanup()}
                  type="button"
                  variant="subtle"
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
                </Button>
                <Button
                  aria-label={t('files.action.refresh')}
                  disabled={refreshing}
                  iconOnly
                  onClick={() => void orphansQuery.refetch()}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn('size-4', refreshing && 'animate-spin')}
                  />
                </Button>
              </div>
            </header>

            <SearchRow
              onChange={setSearchQuery}
              placeholder={t('files.search.placeholder')}
              value={searchQuery}
            />

            {filtered.length > 0 ? (
              <div className="flex h-9 shrink-0 items-center gap-3 border-b border-neutral-200 bg-neutral-50/60 px-4 text-xs dark:border-neutral-800 dark:bg-neutral-900/40">
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
                <span className="text-neutral-500 dark:text-neutral-400">
                  {selectAllAcross
                    ? t('files.orphans.allSelected', { count: total })
                    : selectedCount > 0
                      ? t('files.orphans.selectedCount', {
                          count: selectedCount,
                        })
                      : t('files.orphans.selectCurrentPage')}
                </span>
                {allVisibleSelected && pageCount > 1 && !selectAllAcross ? (
                  <button
                    className="text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-200"
                    onClick={() => setSelectAllAcross(true)}
                    type="button"
                  >
                    {t('files.orphans.selectEvery', { count: total })}
                  </button>
                ) : null}
                {selectAllAcross ? (
                  <button
                    className="text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-200"
                    onClick={() => {
                      setSelectAllAcross(false)
                      selection.clear()
                    }}
                    type="button"
                  >
                    {t('files.orphans.deselectAll')}
                  </button>
                ) : null}
                <button
                  className={cn(
                    'ml-auto inline-flex h-6 items-center gap-1 rounded px-2 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40',
                    !hasSelection && 'pointer-events-none invisible',
                  )}
                  disabled={!hasSelection || batchDeleteMutation.isPending}
                  onClick={() => void confirmBatchDelete()}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  {selectAllAcross
                    ? t('files.orphans.deleteAll', { count: total })
                    : t('files.orphans.deleteSelected', {
                        count: selectedCount,
                      })}
                </button>
              </div>
            ) : null}

            <Scroll className="flex-1">
              {orphansQuery.isLoading && adapted.length === 0 ? (
                <FileListSkeleton />
              ) : filtered.length === 0 ? (
                <FileListEmpty
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
                        selection.selectOne(item.id)
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
              <div className="flex shrink-0 items-center justify-end border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
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
