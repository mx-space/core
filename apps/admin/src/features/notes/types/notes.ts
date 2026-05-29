import type { PatchNoteData } from '~/api/notes'

export type NoteFilter = 'all' | 'bookmark' | 'unpublished'

export type NoteSortKey =
  | 'createdAt'
  | 'modifiedAt'
  | 'mood'
  | 'title'
  | 'weather'

export type SortOrder = 'asc' | 'desc'

export interface NoteMetadataUpdate extends PatchNoteData {
  bookmark?: boolean
  mood?: string | null
  weather?: string | null
}
