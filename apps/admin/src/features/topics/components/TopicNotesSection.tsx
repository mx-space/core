import { Plus } from 'lucide-react'
import type { Pager } from '~/models/base'
import type { NoteModel } from '~/models/note'

import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { Button } from '~/ui/primitives/button'

import { topicNotesPageSize } from '../constants'
import { NoteListSkeleton } from './NoteListSkeleton'
import { TopicNoteRow } from './TopicNoteRow'

export function TopicNotesSection(props: {
  loading: boolean
  notes: Partial<NoteModel>[]
  onAdd: () => void
  onRemove: (note: Partial<NoteModel>) => void
  page: number
  pagination?: Pager
  removing: boolean
  setPage: (page: number) => void
}) {
  const { t } = useI18n()
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('topics.notes.title')}
          {props.pagination ? (
            <span className="ml-1 text-xs text-neutral-400">
              ({props.pagination.total})
            </span>
          ) : null}
        </h3>
        <Button className="h-8 px-2" onClick={props.onAdd} type="button">
          <Plus aria-hidden="true" className="size-4" />
          {t('topics.notes.add')}
        </Button>
      </div>

      {props.loading ? (
        <NoteListSkeleton />
      ) : props.notes.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
          {t('topics.notes.empty')}
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-neutral-200 dark:border-neutral-800">
          {props.notes.map((note) => (
            <TopicNoteRow
              key={note.id}
              note={note}
              onRemove={() => props.onRemove(note)}
              removing={props.removing}
            />
          ))}
        </div>
      )}

      {props.pagination && props.pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {t('topics.notes.pageIndicator', { page: props.page })}
          </span>
          <CompactPagination
            onPageChange={props.setPage}
            onPageSizeChange={() => undefined}
            page={props.page}
            pageCount={props.pagination.totalPages}
            pageSize={topicNotesPageSize}
            pageSizes={[topicNotesPageSize]}
          />
        </div>
      ) : null}
    </section>
  )
}
