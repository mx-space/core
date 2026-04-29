import { index, modelOptions, prop } from '@typegoose/typegoose'

import { TRANSLATION_ENTRY_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

export type TranslationEntryKeyPath =
  | 'category.name'
  | 'topic.name'
  | 'topic.introduce'
  | 'topic.description'
  | 'note.mood'
  | 'note.weather'

export type TranslationEntryKeyType = 'entity' | 'dict'

@modelOptions({
  options: {
    customName: TRANSLATION_ENTRY_COLLECTION_NAME,
  },
})
@index({ keyPath: 1, lang: 1, keyType: 1, lookupKey: 1 }, { unique: true })
@index({ keyPath: 1, lang: 1 })
@index({ lookupKey: 1 })
export class TranslationEntryModel extends BaseModel {
  @prop({ required: true })
  keyPath: TranslationEntryKeyPath

  @prop({ required: true })
  lang: string

  @prop({ required: true })
  keyType: TranslationEntryKeyType

  @prop({ required: true })
  lookupKey: string

  @prop({ required: true })
  sourceText: string

  @prop({ required: true })
  translatedText: string

  @prop({ type: Date })
  sourceUpdatedAt?: Date
}
