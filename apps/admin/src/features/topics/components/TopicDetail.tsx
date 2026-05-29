import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit3, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { patchNote } from '~/api/notes'
import { getNotesByTopic, getTopic } from '~/api/topics'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { TopicModel } from '~/models/topic'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { topicNotesPageSize } from '../constants'
import { getErrorMessage } from '../utils/errors'
import { presentAddNotesToTopic } from './AddNotesToTopicModal'
import { DetailError } from './DetailError'
import { TopicDetailSkeleton } from './TopicDetailSkeleton'
import { TopicNotesSection } from './TopicNotesSection'
import { TopicSummary } from './TopicSummary'

export function TopicDetail(props: {
  deleting: boolean
  onBack: () => void
  onDelete: (topic: TopicModel) => void
  onEdit: (topic: TopicModel) => void
  topicId: string
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [notesPage, setNotesPage] = useState(1)

  const topicQuery = useQuery({
    queryFn: () => getTopic(props.topicId),
    queryKey: ['topics', 'detail', props.topicId],
  })
  const notesQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getNotesByTopic(props.topicId, {
        page: notesPage,
        size: topicNotesPageSize,
      }),
    queryKey: ['topics', 'notes', props.topicId, notesPage],
  })

  useEffect(() => {
    setNotesPage(1)
  }, [props.topicId])

  const topic = topicQuery.data
  const notes = notesQuery.data?.data ?? []
  const notesPagination = notesQuery.data?.pagination

  const removeNoteMutation = useMutation({
    mutationFn: (noteId: string) => patchNote(noteId, { topicId: null }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('topics.detail.removeRefFailed'))),
    onSuccess: async () => {
      toast.success(t('topics.detail.removeRefSuccess'))
      await queryClient.invalidateQueries({
        queryKey: ['topics', 'notes', props.topicId],
      })
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })

  const openAddNotes = async () => {
    const ok = await presentAddNotesToTopic(props.topicId)
    if (ok) {
      setNotesPage(1)
      await queryClient.invalidateQueries({
        queryKey: ['topics', 'notes', props.topicId],
      })
      await queryClient.invalidateQueries({ queryKey: ['notes'] })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <button
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {t('topics.detail.title')}
          </h2>
        </div>
        {topic ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              onClick={() => props.onEdit(topic)}
              type="button"
              variant="subtle"
            >
              <Edit3 aria-hidden="true" className="size-4" />
              {t('common.edit')}
            </Button>
            <Button
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
              disabled={props.deleting}
              onClick={() => props.onDelete(topic)}
              type="button"
              variant="subtle"
            >
              {props.deleting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="size-4" />
              )}
              {t('common.delete')}
            </Button>
          </div>
        ) : null}
      </div>

      <Scroll className="flex-1" innerClassName="p-5">
        {topicQuery.isLoading ? (
          <TopicDetailSkeleton />
        ) : topicQuery.isError || !topic ? (
          <DetailError onRetry={() => void topicQuery.refetch()} />
        ) : (
          <>
            <TopicSummary topic={topic} />
            <TopicNotesSection
              loading={notesQuery.isLoading && notes.length === 0}
              notes={notes}
              onAdd={() => void openAddNotes()}
              onRemove={(note) => {
                if (
                  window.confirm(
                    t('topics.notes.confirmRemove', {
                      title: note.title ?? '',
                    }),
                  )
                ) {
                  removeNoteMutation.mutate(note.id!)
                }
              }}
              pagination={notesPagination}
              page={notesPage}
              removing={removeNoteMutation.isPending}
              setPage={setNotesPage}
            />
          </>
        )}
      </Scroll>
    </div>
  )
}
