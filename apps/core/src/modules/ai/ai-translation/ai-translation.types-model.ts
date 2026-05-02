import type { BaseModel } from '~/shared/types/legacy-model.type'

export interface AITranslationModel extends BaseModel {
  id: string
  hash: string
  ref: any
  refId: string
  refType: string
  lang: string
  sourceLang: string
  title: string
  text: string
  subtitle?: string | null
  summary?: string | null
  tags: string[]
  sourceModified?: Date | null
  sourceModifiedAt?: Date | null
  aiModel?: string
  aiProvider?: string
  contentFormat?: string
  content?: string
  sourceBlockSnapshots?: any[]
  sourceMetaHashes?: any
}
