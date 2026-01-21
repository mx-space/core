import { prop, PropType } from '@typegoose/typegoose'
import { BaseCommentIndexModel } from './base-comment.model'
import { ImageModel } from './image.model'

export class WriteBaseModel extends BaseCommentIndexModel {
  @prop({ trim: true, index: true, required: true })
  title: string

  @prop({ trim: true })
  text: string

  @prop({ type: ImageModel })
  images?: ImageModel[]

  @prop({ default: null, type: Date })
  modified: Date | null

  @prop()
  declare created?: Date

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

  static get protectedKeys() {
    return super.protectedKeys
  }
}
