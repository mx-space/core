import { Transform } from 'class-transformer'
import {
  ArrayUnique,
  IsBoolean,
  IsDate,
  isDateString,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { Types } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseAutoPopulate from 'mongoose-autopopulate'
import type { Paginator } from '~/shared/interface/paginator.interface'

import { UnprocessableEntityException } from '@nestjs/common'
import { PartialType } from '@nestjs/mapped-types'
import {
  index,
  modelOptions,
  plugin,
  prop,
  Ref,
  Severity,
} from '@typegoose/typegoose'

import { CountModel as Count } from '~/shared/model/count.model'
import { WriteBaseModel } from '~/shared/model/write-base.model'

import { CategoryModel as Category } from '../category/category.model'

@plugin(aggregatePaginate)
@plugin(mongooseAutoPopulate)
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
  categoryId: Ref<Category>

  @prop({
    ref: () => Category,
    foreignField: '_id',
    localField: 'categoryId',
    justOne: true,
    autopopulate: true,
  })
  public category: Ref<Category>

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
  count?: Count

  @prop()
  @IsDate()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'undefined' || value === null) {
      return value
    }
    const isDateIsoString = isDateString(value)
    if (isDateIsoString) {
      return new Date(value)
    }
    if (typeof value != 'boolean') {
      throw new UnprocessableEntityException('pin value must be boolean')
    }

    if (value === true) {
      return new Date()
    } else {
      return null
    }
  })
  pin?: Date | null

  @prop()
  @Min(0)
  @IsInt()
  @IsOptional()
  @Transform(({ obj, value }) => {
    if (!obj.pin) {
      return null
    }
    return value
  })
  pinOrder?: number

  @IsOptional()
  @IsMongoId({ each: true })
  relatedId?: string[]
  @prop({
    type: Types.ObjectId,
    ref: () => PostModel,
    autopopulate: {
      maxDepth: 2,
      select: 'title slug id _id categoryId category',
    },
  })
  related?: Partial<PostModel>[]

  static get protectedKeys() {
    return ['count'].concat(super.protectedKeys)
  }
}

export class PartialPostModel extends PartialType(PostModel) {}

export class PostPaginatorModel {
  data: PostModel[]
  pagination: Paginator
}
