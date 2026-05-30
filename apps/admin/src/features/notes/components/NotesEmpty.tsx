import { BookOpen, Plus } from 'lucide-react'

import { useI18n } from '~/i18n'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { ButtonLink } from '~/ui/primitives/button'

import type { NoteFilter } from '../types/notes'

export function NotesEmpty(props: { filter: NoteFilter; keyword: string }) {
  const { t } = useI18n()
  const isPlainEmpty = !props.keyword && props.filter === 'all'
  const title = props.keyword
    ? t('notes.empty.hasSearch')
    : props.filter === 'bookmark'
      ? t('notes.empty.bookmark')
      : props.filter === 'unpublished'
        ? t('notes.empty.unpublished')
        : t('notes.empty.title')

  return (
    <div className="flex min-h-[24rem] items-center justify-center px-4">
      <EmptyState
        action={
          isPlainEmpty ? (
            <ButtonLink to="/notes/edit" variant="subtle">
              <Plus aria-hidden="true" className="size-4" />
              {t('notes.empty.create')}
            </ButtonLink>
          ) : null
        }
        icon={BookOpen}
        title={title}
      />
    </div>
  )
}
