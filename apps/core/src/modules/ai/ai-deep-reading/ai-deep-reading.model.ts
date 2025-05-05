import mongoose from 'mongoose'

import { modelOptions, prop } from '@typegoose/typegoose'

import { AI_DEEP_READING_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  options: {
    customName: AI_DEEP_READING_COLLECTION_NAME,
  },
})
export class AIDeepReadingModel extends BaseModel {
  @prop({
    required: true,
  })
  hash: string

  @prop({
    required: true,
  })
  refId: string

  @prop({ type: [String] })
  keyPoints?: mongoose.Types.Array<string>

  @prop()
  criticalAnalysis?: string

  @prop()
  content?: string
}
