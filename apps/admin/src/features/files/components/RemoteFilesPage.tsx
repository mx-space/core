import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { RemoteFile } from '~/api/files'
import { deleteRemoteFile } from '~/api/files'
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
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { FILES_PAGE_SIZE, filesQueryKey } from '../constants'
import { useFileSearch } from '../hooks/useFileSearch'
import { useRemoteFilesList } from '../hooks/useRemoteFilesList'
import type { FileRowItem } from '../utils/adapters'
import { adaptRemoteFile } from '../utils/adapters'
import { getErrorMessage } from '../utils/format'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileListEmpty } from './FileListEmpty'
import { FileListRow } from './FileListRow'
import { FileListSkeleton } from './FileListSkeleton'
import { FilePreviewLightbox } from './FilePreviewLightbox'
import { RemoteFilesRouteContext } from './remote-files-route-context'
import { SearchRow } from './SearchRow'

const FOCUS_SCOPE_ID = 'remote-files-list'

export function RemoteFilesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const { files, page, pageCount, remoteQuery, setPage, total } =
    useRemoteFilesList()
  const [searchQuery, setSearchQuery] = useState('')
  const [preview, setPreview] = useState<null | { name: string; url: string }>(
    null,
  )

  const adapted = useMemo(
    () => files.map((item) => adaptRemoteFile(item, t)),
    [files, t],
  )
  const fileSearch = useFileSearch(adapted)
  const filtered = fileSearch.items

  useEffect(() => {
    if (fileSearch.query !== searchQuery) fileSearch.setQuery(searchQuery)
  }, [searchQuery])

  const pageQuery = page > 1 ? `?page=${page}` : ''

  const closeDetail = useCallback(() => {
    navigate(`/files/remote${pageQuery}`)
  }, [navigate, pageQuery])

  const openItem = useCallback(
    (item: FileRowItem<RemoteFile>) => {
      navigate(`/files/remote/${encodeURIComponent(item.id)}${pageQuery}`)
    },
    [navigate, pageQuery],
  )

  const deleteMutation = useMutation({
    mutationFn: deleteRemoteFile,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('files.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('files.toast.fileDeleted'))
      closeDetail()
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const confirmAndDelete = useCallback(
    async (item: FileRowItem<RemoteFile>) => {
      const ok = await confirmDialog({
        description: item.raw.inUse
          ? t('files.remote.confirmDeleteInUse')
          : undefined,
        destructive: true,
        title: t('files.confirmDeleteNamed', { name: item.name }),
      })
      if (!ok) return
      deleteMutation.mutate(item.id)
    },
    [deleteMutation, t],
  )

  const actions = useMemo<ListAction<FileRowItem<RemoteFile>>[]>(
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

  const { selection } = useListKeyboard<FileRowItem<RemoteFile>>({
    actions,
    getId: (item) => item.id,
    items: filtered,
    onItemFocus: (id) => {
      const item = filtered.find((entry) => entry.id === id)
      if (item) openItem(item)
    },
    resetOn: [page, searchQuery],
    scopeId: FOCUS_SCOPE_ID,
  })

  const refreshing = remoteQuery.isFetching

  const ctxValue = useMemo(
    () => ({
      deleteDisabled: deleteMutation.isPending,
      onBack: closeDetail,
      onDelete: (item: FileRowItem<RemoteFile>) => void confirmAndDelete(item),
      onOpenPreview: (next: { name: string; url: string }) => setPreview(next),
    }),
    [deleteMutation.isPending, closeDetail, confirmAndDelete],
  )

  return (
    <RemoteFilesRouteContext.Provider value={ctxValue}>
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
                  <span className="truncate">
                    {t('files.source.remoteFiles')}
                  </span>
                  <span className="text-xs font-normal tabular-nums text-fg-muted">
                    {total}
                  </span>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={t('files.action.refresh')}
                  disabled={refreshing}
                  iconOnly
                  onClick={() => void remoteQuery.refetch()}
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

            <Scroll className="flex-1">
              {remoteQuery.isLoading && adapted.length === 0 ? (
                <FileListSkeleton />
              ) : filtered.length === 0 ? (
                <FileListEmpty
                  hint={t('files.remote.description')}
                  label={
                    searchQuery
                      ? t('files.search.noMatches')
                      : t('files.empty.remoteFiles')
                  }
                />
              ) : (
                filtered.map((item) => (
                  <FileListRow<RemoteFile>
                    actions={actions}
                    cursor={selection.isCursor(item.id)}
                    isDetailTarget={detailId === item.id}
                    item={item}
                    key={item.id}
                    onSelect={(mode) => {
                      if (mode === 'range') selection.selectRange(item.id)
                      else if (mode === 'toggle')
                        selection.toggleWithAnchor(item.id)
                      else {
                        selection.setCursor(item.id)
                        openItem(item)
                      }
                    }}
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
    </RemoteFilesRouteContext.Provider>
  )
}
