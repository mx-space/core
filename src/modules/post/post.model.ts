import { index, modelOptions, prop, Ref, Severity } from '@typegoose/typegoose'
import { Schema } from 'mongoose'
import { CountMixed as Count, WriteBaseModel } from '~/shared/base.model'
import { CategoryModel as Category } from '../category/category.model'

@index({ slug: 1 })
@index({ modified: -1 })
@index({ text: 'text' })
@modelOptions({ options: { customName: 'Post', allowMixed: Severity.ALLOW } })
export class PostModel extends WriteBaseModel {
  @prop({ trim: true, unique: true, required: true })
  slug!: string

  @prop()
  summary?: string

  @prop({ ref: () => Category, required: true })
  categoryId: Ref<Category>

  @prop({
    ref: () => Category,
    foreignField: '_id',
    localField: 'categoryId',
    justOne: true,
  })
  public category: Ref<Category>

  @prop({ default: false })
  hide?: boolean

  @prop({ default: true })
  copyright?: boolean

  @prop({
    type: String,
  })
  tags?: string[]

  @prop({ type: Count, default: { read: 0, like: 0 }, _id: false })
  count?: Count

  @prop({ type: Schema.Types.Mixed })
  options?: Record<any, any>
}
