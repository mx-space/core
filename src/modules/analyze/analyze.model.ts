import { SchemaTypes } from 'mongoose'
import { UAParser } from 'ua-parser-js'

import { ApiHideProperty } from '@nestjs/swagger'
import { Severity, index, modelOptions, prop } from '@typegoose/typegoose'

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
