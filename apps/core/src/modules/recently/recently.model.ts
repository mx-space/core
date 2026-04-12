import { modelOptions, prop } from '@typegoose/typegoose'
import mongoose from 'mongoose'

import {
  CollectionRefTypes,
  RECENTLY_COLLECTION_NAME,
} from '~/constants/db.constant'
import { BaseCommentIndexModel } from '~/shared/model/base-comment.model'

import { RecentlyTypeEnum } from './recently.schema'

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
  @prop({ default: '' })
  content: string

  @prop({
    type: String,
    enum: Object.values(RecentlyTypeEnum),
    default: RecentlyTypeEnum.Text,
  })
  type: RecentlyTypeEnum

  @prop({ type: () => mongoose.Schema.Types.Mixed })
  metadata?: Record<string, any>

  @prop({ refPath: 'refType' })
  ref: RefType

  @prop({ type: String })
  refType: CollectionRefTypes

  @prop()
  modified?: Date

  @prop({ default: 0 })
  up: number

  @prop({ default: 0 })
  down: number

  get refId() {
    return (this.ref as any)?.id ?? (this.ref as any)?._id ?? this.ref
  }

  set refId(id: string) {
    return
  }
}
