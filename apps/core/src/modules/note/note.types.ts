import type { EntityId } from '~/shared/id/entity-id'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface NoteRow {
  id: EntityId
  nid: number
  title: string
  slug: string | null
  text: string
  content: string | null
  contentFormat: string
  images: unknown[] | null
  meta: Record<string, unknown> | null
  isPublished: boolean
  hasPassword: boolean
  publicAt: Date | null
  mood: string | null
  weather: string | null
  bookmark: boolean
  coordinates: { latitude: number; longitude: number } | null
  location: string | null
  readCount: number
  likeCount: number
  topicId: EntityId | null
  topic?: { id: EntityId; name: string; slug: string } | null
  createdAt: Date
  modifiedAt: Date | null
}

export interface NoteCreateInput {
  nid: number
  contentFormat: string
  title?: string | null
  slug?: string | null
  text?: string | null
  content?: string | null
  images?: unknown[] | null
  meta?: Record<string, unknown> | null
  isPublished?: boolean
  password?: string | null
  publicAt?: Date | null
  createdAt?: Date
  mood?: string | null
  weather?: string | null
  bookmark?: boolean
  coordinates?: { latitude: number; longitude: number } | null
  location?: string | null
  topicId?: EntityId | string | null
}

export type NotePatchInput = Partial<NoteCreateInput> & {
  modifiedAt?: Date | null
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

export interface NoteSortOptions {
  sortBy?: 'createdAt' | 'modifiedAt' | 'title' | 'mood' | 'weather'
  sortOrder?: 1 | -1
}
