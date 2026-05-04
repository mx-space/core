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

export const TRANSLATION_VALIDATION_REQUIRED_SELECT_FIELDS = [
  'refId',
  'hash',
  'sourceLang',
  'sourceModifiedAt',
  'createdAt',
] as const

export const TRANSLATION_VALIDATION_DEFAULT_SELECT =
  'refId refType lang sourceLang title text subtitle summary tags hash sourceModifiedAt createdAt aiModel aiProvider'
