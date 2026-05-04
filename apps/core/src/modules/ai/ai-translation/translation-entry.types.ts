export type TranslationEntryKeyPath =
  | 'category.name'
  | 'note.title'
  | 'note.mood'
  | 'note.weather'
  | 'topic.name'
  | 'topic.description'
  | 'topic.introduce'

export type TranslationEntryKeyType = 'entity' | 'dict'

export interface TranslationEntryModel {
  id?: string
  keyPath: TranslationEntryKeyPath
  lang: string
  keyType: TranslationEntryKeyType
  lookupKey: string
  sourceText: string
  translatedText: string
  sourceUpdatedAt?: Date | null
  created?: Date
}
