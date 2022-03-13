import { ApiHideProperty } from '@nestjs/swagger'
import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { SchemaTypes } from 'mongoose'
import type { UAParser } from 'ua-parser-js'
import { BaseModel } from '~/shared/model/base.model'

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'timestamp',
      updatedAt: false,
    },
  },
  options: {
    customName: 'Analyze',
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
  @ApiHideProperty()
  timestamp: Date
}
