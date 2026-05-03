export interface AITranslationModel {
  id: string
  hash: string
  refId: string
  refType: string
  lang: string
  sourceLang: string
  title: string
  text: string
  subtitle?: string | null
  summary?: string | null
  tags: string[]
  sourceModifiedAt?: Date | null
  aiModel?: string
  aiProvider?: string
  contentFormat?: string
  content?: string
  sourceBlockSnapshots?: any[]
  sourceMetaHashes?: any
  createdAt?: Date | null
}
