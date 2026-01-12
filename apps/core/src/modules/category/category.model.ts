import type { DocumentType } from '@typegoose/typegoose'
import { index, modelOptions, prop } from '@typegoose/typegoose'
import { CATEGORY_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

export type CategoryDocument = DocumentType<CategoryModel>

export enum CategoryType {
  Category,
  Tag,
}

@index({ slug: -1 })
@modelOptions({ options: { customName: CATEGORY_COLLECTION_NAME } })
export class CategoryModel extends BaseModel {
  @prop({ unique: true, trim: true, required: true })
  name!: string

  @prop({ default: CategoryType.Category })
  type?: CategoryType

  @prop({ unique: true, required: true })
  slug!: string
}
