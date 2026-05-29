import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { CommentUploadFile, CommentUploadStatus } from '~/api/files'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { ListAction } from '~/ui/list-actions'
import type { FileRowItem } from '../utils/adapters'

import { deleteCommentUpload, getCommentUploads } from '~/api/files'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import {
  commentStatusOptions,
  FILES_PAGE_SIZE,
  filesQueryKey,
} from '../constants'
import { useFileSearch } from '../hooks/useFileSearch'
import { adaptCommentUpload } from '../utils/adapters'
import { formatBytes, getErrorMessage } from '../utils/format'
import { ChipStrip } from './ChipStrip'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileDetailPane } from './FileDetailPane'
import { FileListEmpty } from './FileListEmpty'
import { FileListRow } from './FileListRow'
import { FileListSkeleton } from './FileListSkeleton'
import { FilePreviewLightbox } from './FilePreviewLightbox'
import { SearchRow } from './SearchRow'
import { MetadataGrid } from './sections/MetadataGrid'
import { PaletteSwatches } from './sections/PaletteSwatches'

const FOCUS_SCOPE_ID = 'comment-images-list'
type Translator = (key: TranslationKey, values?: TranslationValues) => string

function isStatus(value: string | null): value is CommentUploadStatus {
  return (
    value === '' ||
    value === null ||
    value === 'active' ||
    value === 'detached' ||
    value === 'pending'
  )
}

export function CommentImagesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()

  const initialStatus = searchParams.get('status')
  const [status, setStatus] = useState<CommentUploadStatus>(
    isStatus(initialStatus) ? (initialStatus ?? '') : '',
  )
  const [page, setPage] = useState<number>(
    Number(searchParams.get('page')) || 1,
  )
  const [selectedId, setSelectedId] = useState<null | string>(
    searchParams.get('id'),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)
  const [preview, setPreview] = useState<null | { name: string; url: string }>(
    null,
  )
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)

  const commentStatusLabels: Record<
    Exclude<CommentUploadStatus, ''>,
    string
  > = {
    active: t('files.commentStatus.active'),
    detached: t('files.commentStatus.detached'),
    pending: t('files.commentStatus.pending'),
  }

  const commentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getCommentUploads({
        page,
        size: FILES_PAGE_SIZE,
        status: status === '' ? undefined : status,
      }),
    queryKey: [
      ...filesQueryKey,
      'comment-uploads',
      { page, size: FILES_PAGE_SIZE, status },
    ],
  })

  const comments = commentsQuery.data?.data ?? []
  const total = commentsQuery.data?.pagination.total ?? 0
  const pageCount = commentsQuery.data?.pagination.totalPage ?? 1

  const adapted = useMemo(
    () =>
      comments.map((item) => adaptCommentUpload(item, t, commentStatusLabels)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comments, t],
  )
  const fileSearch = useFileSearch(adapted)
  const filtered = fileSearch.items

  useEffect(() => {
    if (fileSearch.query !== searchQuery) fileSearch.setQuery(searchQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  useLayoutEffect(() => {
    const nextStatus = searchParams.get('status')
    const nextPage = Number(searchParams.get('page')) || 1
    const nextId = searchParams.get('id')
    if (isStatus(nextStatus) && (nextStatus ?? '') !== status) {
      setStatus(nextStatus ?? '')
    }
    if (nextPage !== page) setPage(nextPage)
    if (nextId !== selectedId) {
      setSelectedId(nextId)
      setShowDetailOnMobile(Boolean(nextId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (status) next.set('status', status)
    else next.delete('status')
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    if (selectedId) next.set('id', selectedId)
    else next.delete('id')
    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, selectedId])

  const selectedItem = useMemo(
    () => adapted.find((item) => item.id === selectedId) ?? null,
    [adapted, selectedId],
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
      setSelectedId(null)
      setShowDetailOnMobile(false)
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const confirmAndDelete = async (item: FileRowItem<CommentUploadFile>) => {
    const ok = await confirmDialog({
      destructive: true,
      title: t('files.confirmDeleteNamed', { name: item.name }),
    })
    if (!ok) return
    deleteMutation.mutate(item.id)
  }

  const openItem = (item: FileRowItem<CommentUploadFile>) => {
    setSelectedId(item.id)
    setShowDetailOnMobile(true)
  }

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
        run: (targets) => confirmAndDelete(targets[0]),
        shortcut: 'Backspace',
        shortcutLabel: '⌫',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
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

  return (
    <>
      <MasterDetailLayout
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
              <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
                <span className="truncate">
                  {t('files.source.commentImages')}
                </span>
                <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                  {total}
                </span>
              </h2>
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
                setSelectedId(null)
                setShowDetailOnMobile(false)
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
                    isDetailTarget={selectedId === item.id}
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
        showDetailOnMobile={showDetailOnMobile}
        detail={
          <section className="h-full min-h-0">
            {selectedItem ? (
              <FileDetailPane
                thumbhash={selectedItem.thumbhash}
                deleteDisabled={deleteMutation.isPending}
                dominantColor={selectedItem.palette?.dominant}
                isMobile={!isDesktop}
                name={selectedItem.name}
                onBack={() => setShowDetailOnMobile(false)}
                onDelete={() => void confirmAndDelete(selectedItem)}
                onOpenPreview={() =>
                  setPreview({
                    name: selectedItem.name,
                    url: selectedItem.url,
                  })
                }
                sections={buildSections({
                  item: selectedItem,
                  statusLabels: commentStatusLabels,
                  t,
                })}
                url={selectedItem.url}
              />
            ) : (
              <FileDetailEmpty />
            )}
          </section>
        }
      />
      <FilePreviewLightbox image={preview} onClose={() => setPreview(null)} />
    </>
  )
}

function buildSections(args: {
  item: FileRowItem<CommentUploadFile>
  statusLabels: Record<Exclude<CommentUploadStatus, ''>, string>
  t: Translator
}) {
  const { item, statusLabels, t } = args
  const raw = item.raw
  const unknown = t('files.detail.value.unknown')
  const ref =
    raw.refType && raw.refId
      ? `${raw.refType}/${raw.refId}`
      : t('files.detail.value.unbound')

  return [
    {
      key: 'status',
      title: t('files.detail.section.status'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'status',
              label: t('files.detail.field.status'),
              value: statusLabels[raw.status],
            },
            {
              key: 'detachedAt',
              label: t('files.detail.field.detachedAt'),
              value: raw.detachedAt
                ? relativeTimeFromNow(raw.detachedAt)
                : unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'reference',
      title: t('files.detail.section.reference'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'ref',
              label: t('files.detail.field.refType'),
              value: ref,
            },
            {
              key: 'reader',
              label: t('files.detail.field.readerId'),
              value: raw.readerId ?? unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'image',
      title: t('files.detail.section.image'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'url',
              label: t('files.detail.field.url'),
              mono: true,
              value: raw.fileUrl,
            },
            {
              key: 'size',
              label: t('files.detail.field.size'),
              value: formatBytes(raw.byteSize),
            },
            {
              key: 'mime',
              label: t('files.detail.field.mime'),
              value: raw.mimeType ?? unknown,
            },
            {
              key: 'created',
              label: t('files.detail.field.created'),
              value: relativeTimeFromNow(raw.createdAt),
            },
          ]}
        />
      ),
    },
    {
      key: 'appearance',
      title: t('files.detail.section.appearance'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'palette',
              label: t('files.detail.field.palette'),
              value: <PaletteSwatches palette={raw.palette} />,
            },
            {
              key: 'thumbhash',
              label: t('files.detail.field.thumbhash'),
              mono: true,
              value: raw.thumbhash ?? unknown,
            },
          ]}
        />
      ),
    },
  ]
}
