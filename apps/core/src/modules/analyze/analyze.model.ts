import { SchemaTypes } from 'mongoose'
import { UAParser } from 'ua-parser-js'

import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'

import { Analyze_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
      updatedAt: false,
    },
  },
  options: {
    customName: Analyze_COLLECTION_NAME,
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
  path?: string

  timestamp: Date
}
