import type { Image, ModelWithLiked, ModelWithTranslation } from './base'
import type { TopicModel } from './topic'

export interface NoteModel {
  id: string
  nid: number
  title: string
  slug?: string | null
  text: string
  content?: string | null
  contentFormat: 'markdown' | 'lexical'
  images?: Image[] | null
  meta?: Record<string, any> | null

  isPublished: boolean
  hasPassword: boolean
  password?: string | null
  publicAt?: string | Date | null

  mood?: string | null
  weather?: string | null
  bookmark: boolean

  coordinates?: Coordinate | null
  location?: string | null

  readCount: number
  likeCount: number

  topicId?: string | null
  topic?: TopicModel | null

  createdAt: string
  modifiedAt: string | null
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

export interface NoteWrappedWithLikedAndTranslationPayload {
  data: ModelWithLiked<ModelWithTranslation<NoteModel>>
  next?: Partial<NoteModel>
  prev?: Partial<NoteModel>
}
