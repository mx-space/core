import type { ModelWithLiked, TextBaseModel } from './base'
import type { TopicModel } from './topic'

export interface NoteModel extends TextBaseModel {
  hide: boolean
  count: {
    read: number
    like: number
  }

  mood?: string
  weather?: string
  hasMemory?: boolean

  secret?: Date
  password?: string | null
  nid: number
  music?: NoteMusicRecord[]
  location?: string

  coordinates?: Coordinate
  topic?: TopicModel
  topicId?: string
}

export interface NoteMusicRecord {
  type: string
  id: string
}

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface NoteWrappedPayload {
  data: NoteModel
  next?: Partial<NoteModel>
  prev?: Partial<NoteModel>
}

export interface NoteWrappedWithLikedPayload {
  data: ModelWithLiked<NoteModel>
  next?: Partial<NoteModel>
  prev?: Partial<NoteModel>
}
