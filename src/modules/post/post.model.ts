import { ApiHideProperty, ApiProperty } from '@nestjs/swagger'
import { index, modelOptions, prop, Ref, Severity } from '@typegoose/typegoose'
import {
  ArrayUnique,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import { CountMixed as Count, WriteBaseModel } from '~/shared/model/base.model'
import { CategoryModel as Category } from '../category/category.model'

@index({ slug: 1 })
@index({ modified: -1 })
@index({ text: 'text' })
@modelOptions({ options: { customName: 'Post', allowMixed: Severity.ALLOW } })
export class PostModel extends WriteBaseModel {
  @prop({ trim: true, unique: true, required: true })
  @IsString()
  @IsNotEmpty()
  slug!: string

  @prop()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  summary?: string

  @prop({ ref: () => Category, required: true })
  @IsMongoId()
  @ApiProperty({ example: '5eb2c62a613a5ab0642f1f7a' })
  categoryId: Ref<Category>

  @prop({
    ref: () => Category,
    foreignField: '_id',
    localField: 'categoryId',
    justOne: true,
  })
  @ApiHideProperty()
  public category: Ref<Category>

  @prop({ default: false })
  @IsBoolean()
  @IsOptional()
  hide?: boolean

  @prop({ default: true })
  @IsBoolean()
  @IsOptional()
  copyright?: boolean

  @prop({
    type: String,
  })
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  @ArrayUnique()
  @IsOptional()
  tags?: string[]
  @prop({ type: Count, default: { read: 0, like: 0 }, _id: false })
  @ApiHideProperty()
  count?: Count
}
