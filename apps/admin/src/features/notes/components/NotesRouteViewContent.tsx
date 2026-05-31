import { BookOpen, Plus, Trash2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useRef } from 'react'

import { WEB_URL } from '~/constants/env'
import {
  ContentListRefreshButton,
  ContentListToolbar,
  SortMenu,
} from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import type { NoteModel } from '~/models/note'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { PageHeader } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { ButtonLink } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'

import {
  noteFilterOptionDefinitions,
  noteSortOptionDefinitions,
  notesPageSize,
} from '../constants'
import { useNoteMutations } from '../hooks/use-note-mutations'
import { useNotesList } from '../hooks/use-notes-list'
import type { NoteSortKey } from '../types/notes'
import { buildNotePublicPath } from '../utils/format'
import { buildNoteActions } from './buildNoteActions'
import { NoteRow } from './NoteRow'
import { NotesEmpty } from './NotesEmpty'
import { NotesError } from './NotesError'
import { NotesSkeleton } from './NotesSkeleton'

const FOCUS_SCOPE_ID = 'notes-list'

export function NotesRouteViewContent() {
  const { t } = useI18n()
  const list = useNotesList()
  const {
    filter,
    keyword,
    keywordInput,
    notes,
    notesQuery,
    page,
    pagination,
    setFilter,
    setKeywordInput,
    setPage,
    setSort,
    sortKey,
    sortOrder,
    submitSearch,
  } = list

  // selection created by useListKeyboard later (after `actions`). Mutations
  // that fire selection.clear() go through this ref to avoid TDZ.
  const selectionClearRef = useRef<(() => void) | null>(null)

  const {
    batchDeleteMutation,
    deleteMutation,
    patchMutation,
    publishMutation,
  } = useNoteMutations({
    onBatchSuccess: () => selectionClearRef.current?.(),
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
    submitSearch()
  }

  const toggleAllVisible = (checked: boolean) => {
    if (checked) selection.selectAll()
    else selection.clear()
  }

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col bg-background"
      id={FOCUS_SCOPE_ID}
    >
      <PageHeader
        actions={
          <ButtonLink
            aria-label={t('notes.action.newNote')}
            className="text-xs"
            to="/notes/edit"
          >
            <Plus aria-hidden="true" className="size-3.5" />
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
          <ContentListRefreshButton
            isFetching={notesQuery.isFetching}
            label={t('notes.list.refreshAria')}
            onRefresh={() => void notesQuery.refetch()}
          />
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
            onChange={setSort}
            options={sortOptions}
            order={sortOrder}
          />
        }
        hasSearch={Boolean(keyword)}
        onClearSearch={list.clearSearch}
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
                cursor={selection.isCursor(note.id)}
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
                  else selection.setCursor(id)
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
