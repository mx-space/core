import { IsBoolean, IsOptional } from 'class-validator'

import { ApiHideProperty } from '@nestjs/swagger'
import { prop } from '@typegoose/typegoose'

import { BaseModel } from './base.model'

export abstract class BaseCommentIndexModel extends BaseModel {
  @prop({ default: 0 })
  @ApiHideProperty()
  commentsIndex?: number

  @prop({ default: true })
  @IsBoolean()
  @IsOptional()
  allowComment: boolean

  static get protectedKeys() {
    return ['commentsIndex'].concat(super.protectedKeys)
  }
}
