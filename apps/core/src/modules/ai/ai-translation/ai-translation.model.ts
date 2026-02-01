import { index, modelOptions, prop } from '@typegoose/typegoose'
import { AI_TRANSLATION_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: AI_TRANSLATION_COLLECTION_NAME,
  },
})
@index({ refId: 1, refType: 1, lang: 1 }, { unique: true })
@index({ refId: 1 })
export class AITranslationModel extends BaseModel {
  @prop({ required: true })
  hash: string

  @prop({ required: true })
  refId: string

  @prop({ required: true })
  refType: string

  @prop({ required: true })
  lang: string

  @prop({ required: true })
  sourceLang: string

  @prop({ required: true })
  title: string

  @prop({ required: true })
  text: string

  @prop()
  summary?: string

  @prop({ type: () => [String] })
  tags?: string[]

  /**
   * Snapshot of source article's modified time when translation is generated.
   */
  @prop({ type: Date })
  sourceModified?: Date

  /**
   * AI model metadata for audit/debug.
   * Note: existing documents may not have these fields.
   */
  @prop()
  aiModel?: string

  @prop()
  aiProvider?: string
}
