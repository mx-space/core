import { Field, ObjectType } from '@nestjs/graphql'
import { PartialType } from '@nestjs/mapped-types'
import { ApiHideProperty, ApiProperty } from '@nestjs/swagger'
import {
  DocumentType,
  index,
  modelOptions,
  pre,
  prop,
  Ref,
  Severity,
} from '@typegoose/typegoose'
import { BeAnObject } from '@typegoose/typegoose/lib/types'
import {
  ArrayUnique,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import { Query } from 'mongoose'
import {
  CountMixed as Count,
  Paginator,
  WriteBaseModel,
} from '~/shared/model/base.model'
import {
  CategoryModel as Category,
  CategoryModel,
} from '../category/category.model'

function autoPopulateCategory(
  this: Query<
    any,
    DocumentType<PostModel, BeAnObject>,
    {},
    DocumentType<PostModel, BeAnObject>
  >,
  next: () => void,
) {
  this.populate({ path: 'category' })
  next()
}

@pre<PostModel>('findOne', autoPopulateCategory)
@pre<PostModel>('find', autoPopulateCategory)
@index({ slug: 1 })
@index({ modified: -1 })
@index({ text: 'text' })
@modelOptions({ options: { customName: 'Post', allowMixed: Severity.ALLOW } })
@ObjectType()
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
  @Field(() => String)
  categoryId: Ref<Category>

  @prop({
    ref: () => Category,
    foreignField: '_id',
    localField: 'categoryId',
    justOne: true,
  })
  @ApiHideProperty()
  @Field(() => CategoryModel, { nullable: true })
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
  @Field(() => Count, { nullable: true })
  count?: Count

  static get protectedKeys() {
    return ['count'].concat(super.protectedKeys)
  }
}

export class PartialPostModel extends PartialType(PostModel) {}

@ObjectType()
export class PostPaginatorModel {
  data: PostModel[]
  pagination: Paginator
}
