import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { CommentUploadFile, CommentUploadStatus } from '~/api/files'
import { deleteCommentUpload } from '~/api/files'
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

import {
  commentStatusOptions,
  FILES_PAGE_SIZE,
  filesQueryKey,
} from '../constants'
import { useCommentImagesList } from '../hooks/useCommentImagesList'
import { useFileSearch } from '../hooks/useFileSearch'
import type { FileRowItem } from '../utils/adapters'
import { adaptCommentUpload } from '../utils/adapters'
import { getErrorMessage } from '../utils/format'
import { ChipStrip } from './ChipStrip'
import { CommentImagesRouteContext } from './comment-images-route-context'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileListEmpty } from './FileListEmpty'
import { FileListRow } from './FileListRow'
import { FileListSkeleton } from './FileListSkeleton'
import { FilePreviewLightbox } from './FilePreviewLightbox'
import { SearchRow } from './SearchRow'

const FOCUS_SCOPE_ID = 'comment-images-list'

export function CommentImagesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const {
    comments,
    commentsQuery,
    page,
    pageCount,
    setPage,
    setStatus,
    status,
    total,
  } = useCommentImagesList()
  const [searchQuery, setSearchQuery] = useState('')
  const [preview, setPreview] = useState<null | { name: string; url: string }>(
    null,
  )

  const commentStatusLabels: Record<
    Exclude<CommentUploadStatus, ''>,
    string
  > = {
    active: t('files.commentStatus.active'),
    detached: t('files.commentStatus.detached'),
    pending: t('files.commentStatus.pending'),
  }

  const adapted = useMemo(
    () =>
      comments.map((item) => adaptCommentUpload(item, t, commentStatusLabels)),
    [comments, t],
  )
  const fileSearch = useFileSearch(adapted)
  const filtered = fileSearch.items

  useEffect(() => {
    if (fileSearch.query !== searchQuery) fileSearch.setQuery(searchQuery)
  }, [searchQuery])

  const buildListPath = useCallback(() => {
    const sp = new URLSearchParams()
    if (status) sp.set('status', status)
    if (page > 1) sp.set('page', String(page))
    const qs = sp.toString()
    return `/files/comment-images${qs ? `?${qs}` : ''}`
  }, [page, status])

  const closeDetail = useCallback(() => {
    navigate(buildListPath())
  }, [buildListPath, navigate])

  const openItem = useCallback(
    (item: FileRowItem<CommentUploadFile>) => {
      const sp = new URLSearchParams()
      if (status) sp.set('status', status)
      if (page > 1) sp.set('page', String(page))
      const qs = sp.toString()
      navigate(
        `/files/comment-images/${encodeURIComponent(item.id)}${qs ? `?${qs}` : ''}`,
      )
    },
    [navigate, page, status],
  )

  const deleteMutation = useMutation({
    mutationFn: deleteCommentUpload,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('files.toast.deleteFailed'))),
    onSuccess: async (result) => {
      if (result.storageRemoved) {
        toast.success(t('files.toast.commentDeletedWithStorage'))
      } else {
        toast.warning(t('files.toast.commentDeletedStorageFailed'))
      }
      closeDetail()
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const confirmAndDelete = useCallback(
    async (item: FileRowItem<CommentUploadFile>) => {
      const ok = await confirmDialog({
        destructive: true,
        title: t('files.confirmDeleteNamed', { name: item.name }),
      })
      if (!ok) return
      deleteMutation.mutate(item.id)
    },
    [deleteMutation, t],
  )

  const actions = useMemo<ListAction<FileRowItem<CommentUploadFile>>[]>(
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

  const { selection } = useListKeyboard<FileRowItem<CommentUploadFile>>({
    actions,
    getId: (item) => item.id,
    items: filtered,
    resetOn: [status, page, searchQuery],
    scopeId: FOCUS_SCOPE_ID,
  })

  const chipOptions = commentStatusOptions.map((option) => ({
    label: t(option.labelKey),
    value: option.value,
  }))

  const refreshing = commentsQuery.isFetching

  const ctxValue = useMemo(
    () => ({
      status,
      page,
      statusLabels: commentStatusLabels,
      deleteDisabled: deleteMutation.isPending,
      onBack: closeDetail,
      onDelete: (item: FileRowItem<CommentUploadFile>) =>
        void confirmAndDelete(item),
      onOpenPreview: (next: { name: string; url: string }) => setPreview(next),
    }),
    [status, page, deleteMutation.isPending, closeDetail, confirmAndDelete, t],
  )

  return (
    <CommentImagesRouteContext.Provider value={ctxValue}>
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
                  <span className="truncate">
                    {t('files.source.commentImages')}
                  </span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {total}
                  </span>
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={t('files.action.refresh')}
                  disabled={refreshing}
                  iconOnly
                  onClick={() => void commentsQuery.refetch()}
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

            <ChipStrip
              ariaLabel={t('files.commentImages.filterAria')}
              onChange={(next) => {
                setStatus(next)
                setPage(1)
                // Filter change closes detail.
                navigate(
                  `/files/comment-images${next ? `?status=${next}` : ''}`,
                  {
                    replace: true,
                  },
                )
              }}
              options={chipOptions}
              value={status}
            />

            <SearchRow
              onChange={setSearchQuery}
              placeholder={t('files.search.placeholder')}
              value={searchQuery}
            />

            <Scroll className="flex-1">
              {commentsQuery.isLoading && adapted.length === 0 ? (
                <FileListSkeleton />
              ) : filtered.length === 0 ? (
                <FileListEmpty
                  hint={t('files.commentImages.description')}
                  label={
                    searchQuery
                      ? t('files.search.noMatches')
                      : t('files.empty.commentImages')
                  }
                />
              ) : (
                filtered.map((item) => (
                  <FileListRow<CommentUploadFile>
                    actions={actions}
                    isDetailTarget={detailId === item.id}
                    item={item}
                    key={item.id}
                    onSelect={(mode) => {
                      if (mode === 'range') selection.selectRange(item.id)
                      else if (mode === 'toggle')
                        selection.toggleWithAnchor(item.id)
                      else {
                        selection.selectOne(item.id)
                        openItem(item)
                      }
                    }}
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
    </CommentImagesRouteContext.Provider>
  )
}
