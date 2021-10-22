import { Field, ID, ObjectType } from '@nestjs/graphql'
import { ApiHideProperty } from '@nestjs/swagger'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import LeanId from 'mongoose-lean-id'
import { default as mongooseLeanVirtuals } from 'mongoose-lean-virtuals'
import Paginate from 'mongoose-paginate-v2'

@plugin(mongooseLeanVirtuals)
@plugin(Paginate)
@plugin(LeanId)
@modelOptions({
  schemaOptions: {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: {
      createdAt: 'created',
      updatedAt: null,
    },
  },
})
@ObjectType()
export class BaseModel {
  @ApiHideProperty()
  @Field(() => Date)
  created?: Date
  @Field(() => ID)
  @ApiHideProperty()
  id?: string

  static get protectedKeys() {
    return ['created', 'id', '_id']
  }
}

@ObjectType()
export class Paginator {
  /**
   * 总条数
   */
  readonly total: number
  /**
   * 一页多少条
   */
  readonly size: number
  /**
   * 当前页
   */
  readonly currentPage: number
  /**
   * 总页数
   */
  readonly totalPage: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}

@modelOptions({
  schemaOptions: { _id: false },
})
@ObjectType()
class Image {
  @prop()
  width?: number

  @prop()
  height?: number

  @prop()
  accent?: string

  @prop()
  type?: string

  @prop()
  src: string
}

@ObjectType()
export abstract class BaseCommentIndexModel extends BaseModel {
  @prop({ default: 0 })
  @ApiHideProperty()
  commentsIndex?: number

  @prop({ default: true })
  @IsBoolean()
  @IsOptional()
  allowComment: boolean

  static get protectedKeys() {
    return ['commentsIndex'].concat(super.protectedKeys)
  }
}

@ObjectType()
export abstract class WriteBaseModel extends BaseCommentIndexModel {
  @prop({ trim: true, index: true, required: true })
  @IsString()
  @IsNotEmpty()
  title: string

  @prop({ trim: true })
  @IsString()
  text: string

  @prop({ type: Image })
  @ApiHideProperty()
  @Field(() => Image, { nullable: true })
  images?: Image[]

  @prop({ default: null })
  @ApiHideProperty()
  @Field(() => Date, { nullable: true })
  modified: Date | null

  static get protectedKeys() {
    return super.protectedKeys
  }
}

@modelOptions({
  schemaOptions: { id: false, _id: false },
  options: { customName: 'count' },
})
@ObjectType()
export class CountMixed {
  @prop({ default: 0 })
  read?: number

  @prop({ default: 0 })
  like?: number
}

export type { Image as TextImageRecordType }
