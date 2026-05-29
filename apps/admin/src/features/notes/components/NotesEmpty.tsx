import { BookOpen, Plus } from 'lucide-react'
import type { NoteFilter } from '../types/notes'

import { useI18n } from '~/i18n'
import { ButtonLink } from '~/ui/primitives/button'

export function NotesEmpty(props: { filter: NoteFilter; keyword: string }) {
  const { t } = useI18n()
  const isPlainEmpty = !props.keyword && props.filter === 'all'

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
      <BookOpen
        aria-hidden="true"
        className="mb-4 size-10 text-neutral-300 dark:text-neutral-700"
      />
      <p>
        {props.keyword
          ? t('notes.empty.hasSearch')
          : props.filter === 'bookmark'
            ? t('notes.empty.bookmark')
            : props.filter === 'unpublished'
              ? t('notes.empty.unpublished')
              : t('notes.empty.title')}
      </p>
      {isPlainEmpty ? (
        <ButtonLink className="mt-4" to="/notes/edit" variant="subtle">
          <Plus aria-hidden="true" className="size-4" />
          {t('notes.empty.create')}
        </ButtonLink>
      ) : null}
    </div>
  )
}
