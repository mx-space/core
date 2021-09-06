import { ApiHideProperty } from '@nestjs/swagger'
import { modelOptions, prop, Severity } from '@typegoose/typegoose'
import { SchemaTypes } from 'mongoose'
import { BaseModel } from '~/shared/model/base.model'
import type { UAParser } from 'ua-parser-js'

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
