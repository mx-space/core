import { PartialType } from '@nestjs/mapped-types'
import type { DocumentType } from '@typegoose/typegoose'
import { index, modelOptions, prop } from '@typegoose/typegoose'
import { CATEGORY_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export type CategoryDocument = DocumentType<CategoryModel>

export enum CategoryType {
  Category,
  Tag,
}

@index({ slug: -1 })
@modelOptions({ options: { customName: CATEGORY_COLLECTION_NAME } })
export class CategoryModel extends BaseModel {
  @prop({ unique: true, trim: true, required: true })
  @IsString()
  @IsNotEmpty()
  name!: string

  @prop({ default: CategoryType.Category })
  @IsEnum(CategoryType)
  @IsOptional()
  type?: CategoryType

  @prop({ unique: true, required: true })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  slug!: string
}

export class PartialCategoryModel extends PartialType(CategoryModel) {}
