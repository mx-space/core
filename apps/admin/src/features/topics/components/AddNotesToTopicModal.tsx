import type { InfiniteData } from '@tanstack/react-query'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Check, Inbox, Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getNotes } from '~/api/notes'
import { notes as notesCollection } from '~/data/resources/note'
import { patchNoteFields } from '~/data/resources/note.mutations'
import { useI18n } from '~/i18n'
import type { PaginateResult } from '~/models/base'
import type { NoteModel } from '~/models/note'
import { adminQueryKeys } from '~/query/keys'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { topicPickerPageSize } from '../constants'
import { getErrorMessage } from '../utils/errors'

interface AddNotesToTopicModalProps {
  topicId: string
}

function AddNotesToTopicModal(props: AddNotesToTopicModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [keyword, setKeyword] = useState('')

  const notesQuery = useInfiniteQuery<
    PaginateResult<NoteModel>,
    Error,
    InfiniteData<PaginateResult<NoteModel>, number>,
    ReturnType<typeof adminQueryKeys.notes.topicPicker>,
    number
  >({
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const result = await getNotes({
        page: pageParam,
        size: topicPickerPageSize,
      })
      notesCollection.hydrate(result.data)
      return result
    },
    queryKey: adminQueryKeys.notes.topicPicker(props.topicId),
  })

  const notes = useMemo(
    () => notesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [notesQuery.data],
  )
  const filteredNotes = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return notes

    return notes.filter((note) => {
      const title = note.title.toLowerCase()
      const slug = note.slug?.toLowerCase() ?? ''
      const nid = String(note.nid)

      return (
        title.includes(normalizedKeyword) ||
        slug.includes(normalizedKeyword) ||
        nid.includes(normalizedKeyword)
      )
    })
  }, [keyword, notes])

  const addMutation = useMutation({
    mutationFn: async () => {
      const noteIds = Array.from(selectedIds)
      await Promise.all(
        noteIds.map((noteId) =>
          patchNoteFields(noteId, { topicId: props.topicId }),
        ),
      )
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.add.failed'))),
    onSuccess: () => {
      toast.success(t('topics.add.success'))
      modal.close(true)
    },
  })

  const toggleNote = (noteId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  const selectedCount = selectedIds.size

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        subtitle={t('topics.add.subtitle')}
        title={t('topics.add.title')}
      />

      <div className="shrink-0 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <TextInput
          onChange={setKeyword}
          placeholder={t('topics.add.filterPlaceholder')}
          value={keyword}
        />
      </div>

      <Scroll className="max-h-[60vh] min-h-0 flex-1">
        {notesQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                className="h-12 animate-pulse rounded bg-neutral-100 dark:bg-neutral-900"
                key={index}
              />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <Inbox aria-hidden="true" className="size-9 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {t('topics.add.empty')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredNotes.map((note) => {
              const selected = selectedIds.has(note.id)
              const alreadyInTopic = note.topicId === props.topicId

              return (
                <button
                  className={cn(
                    'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
                    alreadyInTopic
                      ? 'cursor-not-allowed opacity-55'
                      : selected
                        ? 'bg-neutral-100 dark:bg-neutral-900'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/70',
                  )}
                  disabled={alreadyInTopic}
                  key={note.id}
                  onClick={() => toggleNote(note.id)}
                  type="button"
                >
                  <span
                    className={cn(
                      'inline-flex size-5 shrink-0 items-center justify-center rounded border text-white',
                      selected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                        : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-950',
                    )}
                  >
                    {selected ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-xs text-neutral-400">
                        #{note.nid}
                      </span>
                      <span className="truncate text-sm font-medium text-neutral-950 dark:text-neutral-50">
                        {note.title || t('topics.notes.unnamed')}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-neutral-400">
                      {note.slug ? (
                        <span className="truncate font-mono">{note.slug}</span>
                      ) : null}
                      {alreadyInTopic ? (
                        <span>{t('topics.add.inTopic')}</span>
                      ) : null}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Scroll>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Button
          disabled={!notesQuery.hasNextPage || notesQuery.isFetchingNextPage}
          onClick={() => void notesQuery.fetchNextPage()}
          type="button"
          variant="subtle"
        >
          {notesQuery.isFetchingNextPage ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {notesQuery.hasNextPage
            ? t('topics.add.loadMore')
            : t('topics.add.allLoaded')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => modal.dismiss()}
            type="button"
            variant="subtle"
          >
            {t('common.cancel')}
          </Button>
          <Button
            disabled={selectedCount === 0 || addMutation.isPending}
            onClick={() => addMutation.mutate()}
            type="button"
          >
            {addMutation.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Plus aria-hidden="true" className="size-4" />
            )}
            {selectedCount > 0
              ? t('topics.add.submitWithCount', { count: selectedCount })
              : t('topics.add.submit')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Open the add-notes-to-topic picker. Resolves true on save success.
 */
export async function presentAddNotesToTopic(
  topicId: string,
): Promise<boolean | undefined> {
  const handle = present<AddNotesToTopicModalProps, boolean>(
    AddNotesToTopicModal,
    { topicId },
    {
      modalProps: {
        className: 'max-h-[min(84vh,42rem)]',
        popupStyle: { width: 'min(92vw, 34rem)' },
      },
    },
  )
  return await handle
}
