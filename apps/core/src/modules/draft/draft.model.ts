import { index, modelOptions, prop, PropType } from '@typegoose/typegoose'
import { DRAFT_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { ImageModel } from '~/shared/model/image.model'
import { Types } from 'mongoose'

export enum DraftRefType {
  Post = 'posts',
  Note = 'notes',
  Page = 'pages',
}

@modelOptions({
  schemaOptions: { _id: false },
})
export class DraftHistoryModel {
  @prop({ required: true })
  version: number

  @prop({ required: true })
  title: string

  @prop({ required: true })
  text: string

  @prop({ type: String })
  typeSpecificData?: string

  @prop({ required: true })
  savedAt: Date
}

@index({ refType: 1, refId: 1 }, { sparse: true })
@index({ updated: -1 })
@modelOptions({
  options: { customName: DRAFT_COLLECTION_NAME },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
export class DraftModel extends BaseModel {
  @prop({ required: true, type: String, enum: DraftRefType })
  refType: DraftRefType

  @prop({ type: Types.ObjectId })
  refId?: Types.ObjectId

  @prop({ trim: true, default: '' })
  title: string

  @prop({ trim: true, default: '' })
  text: string

  @prop({ type: ImageModel })
  images?: ImageModel[]

  @prop(
    {
      type: String,
      get(jsonString) {
        return JSON.safeParse(jsonString)
      },
    },
    PropType.NONE,
  )
  meta?: Record<string, any>

  @prop({ type: String })
  typeSpecificData?: string

  @prop({ default: 1 })
  version: number

  /**
   * 草稿最后被发布时的版本号
   * 当 publishedVersion === version 时，表示草稿内容与已发布内容一致
   */
  @prop()
  publishedVersion?: number

  @prop()
  updated?: Date

  @prop({ type: () => [DraftHistoryModel], default: [] })
  history: DraftHistoryModel[]

  static get protectedKeys() {
    return ['version', 'history', 'updated', 'publishedVersion'].concat(
      super.protectedKeys,
    )
  }
}
