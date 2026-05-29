import type { TranslationKey } from '~/i18n/types'
import type { NoteFilter, NoteSortKey } from './types/notes'

export const filteredNotesFetchSize = 100
export const notesPageSize = 20
export const notesQueryKey = ['notes'] as const

export const noteFilterOptionDefinitions: Array<{
  labelKey: TranslationKey
  value: NoteFilter
}> = [
  { labelKey: 'notes.filter.all', value: 'all' },
  { labelKey: 'notes.filter.bookmark', value: 'bookmark' },
  { labelKey: 'notes.filter.unpublished', value: 'unpublished' },
]

export const noteSortOptionDefinitions: Array<{
  labelKey: TranslationKey
  value: NoteSortKey
}> = [
  { labelKey: 'notes.sort.createdAt', value: 'createdAt' },
  { labelKey: 'notes.sort.modifiedAt', value: 'modifiedAt' },
  { labelKey: 'notes.sort.title', value: 'title' },
  { labelKey: 'notes.sort.mood', value: 'mood' },
  { labelKey: 'notes.sort.weather', value: 'weather' },
]
