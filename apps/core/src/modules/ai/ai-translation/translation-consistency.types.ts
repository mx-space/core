export interface TranslationSourceSnapshot {
  id: string
  title: string
  text?: string
  summary?: string | null
  tags?: string[]
  meta?: { lang?: string }
  contentFormat?: string
  content?: string
  modified?: Date | null
  created?: Date | null
}

export const TRANSLATION_VALIDATION_REQUIRED_SELECT_FIELDS = [
  'refId',
  'hash',
  'sourceLang',
  'sourceModified',
  'created',
] as const

export const TRANSLATION_VALIDATION_DEFAULT_SELECT =
  'refId refType lang sourceLang title text summary tags hash sourceModified created aiModel aiProvider'
