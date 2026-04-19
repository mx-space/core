import { index, modelOptions, prop } from '@typegoose/typegoose'

import { AI_INSIGHTS_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: AI_INSIGHTS_COLLECTION_NAME,
  },
})
@index({ refId: 1, lang: 1 }, { unique: true })
@index({ refId: 1 })
@index({ created: -1 })
export class AIInsightsModel extends BaseModel {
  @prop({ required: true })
  refId: string

  @prop({ required: true })
  lang: string

  @prop({ required: true })
  hash: string

  @prop({ required: true })
  content: string

  @prop({ default: false })
  isTranslation: boolean

  @prop()
  sourceInsightsId?: string

  @prop()
  sourceLang?: string

  @prop({ type: Object })
  modelInfo?: { provider: string; model: string }
}
