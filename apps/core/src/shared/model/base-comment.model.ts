import { prop } from '@typegoose/typegoose'
import { BaseModel } from './base.model'

export abstract class BaseCommentIndexModel extends BaseModel {
  @prop({ default: 0 })
  commentsIndex?: number

  @prop({ default: true })
  allowComment: boolean

  static get protectedKeys() {
    return ['commentsIndex'].concat(super.protectedKeys)
  }
}
