import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { ANALYZE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { SchemaTypes } from 'mongoose'
import { UAParser } from 'ua-parser-js'

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
      updatedAt: false,
    },
  },
  options: {
    customName: ANALYZE_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
@index({ timestamp: -1 })
export class AnalyzeModel extends BaseModel {
  @prop()
  ip?: string

  @prop({ type: SchemaTypes.Mixed })
  ua: UAParser

  @prop()
  country?: string

  @prop()
  path?: string

  timestamp: Date
}
