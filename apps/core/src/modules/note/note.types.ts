import type { WriteBaseModel } from '~/shared/types/legacy-model.type'

import type { TopicModel } from '../topic/topic.types'

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface NoteModel extends WriteBaseModel {
  nid: number
  slug?: string
  isPublished?: boolean
  password?: string | null
  publicAt?: Date | null
  mood?: string
  weather?: string
  bookmark?: boolean
  coordinates?: Coordinate | null
  location?: string | null
  count?: { read?: number; like?: number }
  topicId?: any
  topic?: TopicModel
}

export const NOTE_PROTECTED_KEYS = [
  'nid',
  'count',
  'commentsIndex',
  'created',
  'id',
  '_id',
] as const
