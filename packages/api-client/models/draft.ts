import type { Image } from './base'

export type SharedDraftRefType = 'post' | 'note' | 'page'

export interface SharedDraftModel {
  content: string | null
  contentFormat: 'lexical' | 'markdown'
  createdAt: string
  images: Image[] | null
  refType: SharedDraftRefType
  text: string
  title: string
}
