import { modelOptions, prop } from '@typegoose/typegoose'
import { AI_SUMMARY_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: AI_SUMMARY_COLLECTION_NAME,
  },
})
export class AISummaryModel extends BaseModel {
  @prop({
    required: true,
  })
  hash: string

  @prop({
    required: true,
  })
  summary: string

  @prop({
    required: true,
  })
  refId: string

  @prop()
  lang?: string
}
