import type { NoteRow } from './note.repository'

export interface Coordinate {
  latitude: number
  longitude: number
}

export type NoteModel = NoteRow & {
  password?: string | null
}

export const NOTE_PROTECTED_KEYS = [
  'id',
  'nid',
  'createdAt',
  'readCount',
  'likeCount',
] as const
