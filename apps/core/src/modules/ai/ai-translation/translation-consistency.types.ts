export interface TranslationSourceSnapshot {
  id: string
  title: string
  text?: string
  subtitle?: string | null
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
  contentFormat?: string | null
  content?: string | null
  modifiedAt?: Date | null
  createdAt?: Date | null
}
