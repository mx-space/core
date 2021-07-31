import { DocumentType, index, modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/base.model'

export type CategoryDocument = DocumentType<CategoryModel>

export enum CategoryType {
  Category,
  Tag,
}

@index({ slug: -1 })
@modelOptions({ options: { customName: 'Category' } })
export class CategoryModel extends BaseModel {
  @prop({ unique: true, trim: true, required: true })
  name!: string

  @prop({ default: CategoryType.Category })
  type?: CategoryType

  @prop({ unique: true, required: true })
  slug!: string
}
