import { IsMongoId, IsOptional, IsString } from 'class-validator'

import { modelOptions, prop } from '@typegoose/typegoose'

import { BaseCommentIndexModel } from '~/shared/model/base-comment.model'

import { CommentRefTypes } from '../comment/comment.model'

export type RefType = {
  title: string
  url: string
}

@modelOptions({
  options: {
    customName: 'Recently',
  },
})
export class RecentlyModel extends BaseCommentIndexModel {
  @prop({ required: true })
  @IsString()
  content: string

  @prop({ refPath: 'refType' })
  @IsOptional()
  @IsMongoId()
  ref: RefType

  @prop({ enum: CommentRefTypes })
  refType: string

  /**
   * 顶
   */
  @prop({
    default: 0,
  })
  up: number

  /**
   * 踩
   */
  @prop({
    default: 0,
  })
  down: number

  get refId() {
    return (this.ref as any)?._id ?? this.ref
  }

  set refId(id: string) {
    return
  }
}
