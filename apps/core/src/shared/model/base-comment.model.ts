import { prop } from '@typegoose/typegoose'
import { IsBoolean, IsOptional } from 'class-validator'
import { BaseModel } from './base.model'

export abstract class BaseCommentIndexModel extends BaseModel {
  @prop({ default: 0 })
  commentsIndex?: number

  @prop({ default: true })
  @IsBoolean()
  @IsOptional()
  allowComment: boolean

  static get protectedKeys() {
    return ['commentsIndex'].concat(super.protectedKeys)
  }
}
