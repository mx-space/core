import { modelOptions, prop } from '@typegoose/typegoose'
import {
  CollectionRefTypes,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'
import { BaseCommentIndexModel } from '~/shared/model/base-comment.model'
import { IsMongoId, IsOptional, IsString } from 'class-validator'

export type RefType = {
  title: string
  url: string
}

@modelOptions({
  options: {
    customName: RECENTLY_COLLECTION_NAME,
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

  @prop({ type: String })
  refType: CollectionRefTypes

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
