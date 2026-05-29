import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import {
  deleteNote,
  getNotes,
  patchNote,
  patchNotePublish,
  searchNotes,
} from '~/api/notes'
import { WEB_URL } from '~/constants/env'
import {
  ContentListHeader,
  ContentListToolbar,
  SortMenu,
} from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import type { NoteModel } from '~/models/note'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { useListKeyboard } from '~/ui/list-actions'
import { ButtonLink } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import {
  noteFilterOptionDefinitions,
  noteSortOptionDefinitions,
  notesPageSize,
  notesQueryKey,
} from '../constants'
import type {
  NoteFilter,
  NoteMetadataUpdate,
  NoteSortKey,
  SortOrder,
} from '../types/notes'
import { getErrorMessage } from '../utils/errors'
import { buildNotePublicPath } from '../utils/format'
import { getFilteredNotes } from '../utils/get-filtered-notes'
import {
  readNoteFilter,
  readNoteSortKey,
  readPage,
  readSortOrder,
} from '../utils/search-params'
import { buildNoteActions } from './buildNoteActions'
import { NoteRow } from './NoteRow'
import { NotesEmpty } from './NotesEmpty'
import { NotesError } from './NotesError'
import { NotesSkeleton } from './NotesSkeleton'

const FOCUS_SCOPE_ID = 'notes-list'

export function NotesRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(readPage(searchParams.get('page')))
  const [keywordInput, setKeywordInput] = useState(
    searchParams.get('keyword') ?? '',
  )
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '')
  const [filter, setFilter] = useState<NoteFilter>(
    readNoteFilter(searchParams.get('filter')),
  )
  const [sortKey, setSortKey] = useState<NoteSortKey>(
    readNoteSortKey(searchParams.get('sort')),
  )
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    readSortOrder(searchParams.get('order')),
  )
  const searchParamsKey = searchParams.toString()

  useLayoutEffect(() => {
    const nextPage = readPage(searchParams.get('page'))
    const nextKeyword = searchParams.get('keyword') ?? ''
    const nextFilter = readNoteFilter(searchParams.get('filter'))
    const nextSortKey = readNoteSortKey(searchParams.get('sort'))
    const nextSortOrder = readSortOrder(searchParams.get('order'))

    setPage((value) => (value === nextPage ? value : nextPage))
    setKeyword((value) => (value === nextKeyword ? value : nextKeyword))
    setKeywordInput((value) => (value === nextKeyword ? value : nextKeyword))
    setFilter((value) => (value === nextFilter ? value : nextFilter))
    setSortKey((value) => (value === nextSortKey ? value : nextSortKey))
    setSortOrder((value) => (value === nextSortOrder ? value : nextSortOrder))
  }, [searchParamsKey])

  const notesQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      keyword
        ? searchNotes({ keyword, page, size: notesPageSize })
        : filter === 'all'
          ? getNotes({
              page,
              size: notesPageSize,
              sort_by: sortKey,
              sort_order: sortOrder,
            })
          : getFilteredNotes({
              filter,
              page,
              size: notesPageSize,
              sortKey,
              sortOrder,
            }),
    queryKey: [
      ...notesQueryKey,
      'list',
      { filter, keyword, page, size: notesPageSize, sortKey, sortOrder },
    ],
  })

  const notes = notesQuery.data?.data ?? []
  const pagination = notesQuery.data?.pagination

  // selection created by useListKeyboard later (after `actions`). Mutations
  // that fire selection.clear() go through this ref to avoid TDZ.
  const selectionClearRef = useRef<(() => void) | null>(null)

  const invalidateNotes = async () => {
    await queryClient.invalidateQueries({ queryKey: notesQueryKey })
  }

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (page > 1) nextParams.set('page', String(page))
    if (keyword) nextParams.set('keyword', keyword)
    if (filter !== 'all') nextParams.set('filter', filter)
    if (sortKey !== 'createdAt') nextParams.set('sort', sortKey)
    if (sortOrder !== 'desc') nextParams.set('order', sortOrder)
    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [
    filter,
    keyword,
    page,
    searchParamsKey,
    setSearchParams,
    sortKey,
    sortOrder,
  ])

  const publishMutation = useMutation({
    mutationFn: (payload: { id: string; isPublished: boolean }) =>
      patchNotePublish(payload.id, payload.isPublished),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.updateFailed'))),
    onSuccess: invalidateNotes,
  })

  const patchMutation = useMutation({
    mutationFn: (payload: { data: NoteMetadataUpdate; id: string }) =>
      patchNote(payload.id, payload.data),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.updateFailed'))),
    onSuccess: invalidateNotes,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('notes.toast.deleted'))
      await invalidateNotes()
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteNote(id)))
      const successfulIds = ids.filter(
        (_, index) => results[index].status === 'fulfilled',
      )

      return {
        failedCount: ids.length - successfulIds.length,
        successfulIds,
        successCount: successfulIds.length,
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('notes.toast.batchDeleteFailed'))),
    onSuccess: async ({ failedCount, successCount }) => {
      selectionClearRef.current?.()
      if (failedCount > 0) {
        toast.warning(
          t('notes.toast.batchDeletePartial', {
            failed: failedCount,
            success: successCount,
          }),
        )
      } else {
        toast.success(
          t('notes.toast.batchDeleteSucceeded', { count: successCount }),
        )
      }
      await invalidateNotes()
    },
  })

  const confirmAndDelete = async (targets: NoteModel[]) => {
    if (targets.length === 0) return
    const title =
      targets.length === 1
        ? t('notes.confirmDelete.single', {
            title: targets[0].title || t('notes.row.untitled'),
          })
        : t('notes.confirmDelete.batch', { count: targets.length })
    const confirmed = await confirmDialog({
      destructive: true,
      title,
    })
    if (!confirmed) return
    if (targets.length === 1) {
      deleteMutation.mutate(targets[0].id)
    } else {
      batchDeleteMutation.mutate(targets.map((target) => target.id))
    }
  }

  const actions = useMemo(
    () =>
      buildNoteActions(
        {
          deleteMany: confirmAndDelete,
          navigateToEdit: (note) => {
            window.location.hash = `#/notes/edit?id=${encodeURIComponent(note.id)}`
          },
          openExternal: (note) => {
            window.open(
              `${WEB_URL}${buildNotePublicPath(note)}`,
              '_blank',
              'noopener,noreferrer',
            )
          },
        },
        t,
      ),
    [t],
  )

  const { selection } = useListKeyboard<NoteModel>({
    actions,
    getId: (note) => note.id,
    items: notes,
    resetOn: [filter, keyword, page, sortKey, sortOrder],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear

  const selectedCount = selection.size
  const visibleIds = notes.map((note) => note.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))
  const count = useMemo(() => {
    if (!pagination) return null
    return t('notes.list.count', { count: pagination.total })
  }, [pagination, t])

  const filterOptions = useMemo(
    () =>
      noteFilterOptionDefinitions.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )

  const sortOptions = useMemo(
    () =>
      noteSortOptionDefinitions.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t],
  )

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  const toggleAllVisible = (checked: boolean) => {
    if (checked) selection.selectAll()
    else selection.clear()
  }

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950"
      id={FOCUS_SCOPE_ID}
    >
      <ContentListHeader
        action={
          <ButtonLink aria-label={t('notes.action.newNote')} to="/notes/edit">
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">
              {t('notes.action.newNote')}
            </span>
          </ButtonLink>
        }
        count={count}
        icon={<BookOpen aria-hidden="true" className="size-4" />}
        title={t('notes.title')}
      />

      <ContentListToolbar
        extraActions={
          <button
            aria-label={t('notes.list.refreshAria')}
            className="outline-hidden inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            disabled={notesQuery.isFetching}
            onClick={() => void notesQuery.refetch()}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-3.5',
                notesQuery.isFetching && 'animate-spin',
              )}
            />
          </button>
        }
        filters={
          <SelectField
            aria-label={t('notes.filter.ariaLabel')}
            disabled={Boolean(keyword)}
            onValueChange={(value) => {
              setFilter(value)
              setPage(1)
            }}
            options={filterOptions}
            triggerClassName="w-28 !h-7 !border-transparent !bg-transparent text-xs hover:!bg-neutral-100 dark:hover:!bg-neutral-900"
            value={filter}
          />
        }
        sortMenu={
          <SortMenu<NoteSortKey>
            disabled={Boolean(keyword)}
            field={sortKey}
            onChange={({ field, order }) => {
              setSortKey(field)
              setSortOrder(order)
              setPage(1)
            }}
            options={sortOptions}
            order={sortOrder}
          />
        }
        hasSearch={Boolean(keyword)}
        onClearSearch={() => {
          setKeywordInput('')
          setKeyword('')
          setPage(1)
        }}
        onSearch={onSearch}
        onSearchValueChange={setKeywordInput}
        searchPlaceholder={t('notes.list.searchPlaceholder')}
        searchValue={keywordInput}
        selection={{
          allVisibleSelected,
          bulkActionDisabled:
            selectedCount === 0 || batchDeleteMutation.isPending,
          bulkActionIcon: <Trash2 aria-hidden="true" className="size-4" />,
          bulkActionLabel: t('notes.action.bulkDelete'),
          hasVisibleItems: notes.length > 0,
          indeterminate: selectedCount > 0 && !allVisibleSelected,
          onBulkAction: () => {
            void confirmAndDelete(selection.getSelectedTargets())
          },
          onToggleAllVisible: toggleAllVisible,
          selectAllLabel: t('notes.list.selectAllVisible'),
          selectedCount,
          selectedLabel: t('notes.list.selectedCount', {
            count: selectedCount,
          }),
        }}
      />

      <Scroll className="min-h-0 flex-1">
        {notesQuery.isLoading && notes.length === 0 ? (
          <NotesSkeleton />
        ) : notesQuery.isError ? (
          <NotesError onRetry={() => void notesQuery.refetch()} />
        ) : notes.length === 0 ? (
          <NotesEmpty filter={filter} keyword={keyword} />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {notes.map((note) => (
              <NoteRow
                actions={actions}
                key={note.id}
                note={note}
                onMetadataChange={(id, data) =>
                  patchMutation.mutate({ data, id })
                }
                onPublishChange={(id, isPublished) =>
                  publishMutation.mutate({ id, isPublished })
                }
                onSelect={(id, mode) => {
                  if (mode === 'range') selection.selectRange(id)
                  else if (mode === 'toggle') selection.toggleWithAnchor(id)
                  else selection.selectOne(id)
                }}
                onSelectedChange={() => selection.toggleWithAnchor(note.id)}
                selected={selection.isSelected(note.id)}
              />
            ))}
          </div>
        )}
      </Scroll>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-end border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <CompactPagination
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={pagination.totalPages}
            pageSize={notesPageSize}
            pageSizes={[notesPageSize]}
          />
        </div>
      ) : null}
    </FocusScope>
  )
}
