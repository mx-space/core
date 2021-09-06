import { ApiHideProperty } from '@nestjs/swagger'
import { modelOptions, plugin, prop } from '@typegoose/typegoose'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import mongooseLeanVirtuals from 'mongoose-lean-virtuals'
import Paginate from 'mongoose-paginate-v2'

@plugin(mongooseLeanVirtuals)
@plugin(Paginate)
export class BaseModel {
  @ApiHideProperty()
  created?: Date

  static get protectedKeys() {
    return ['created', 'id', '_id']
  }
}

export interface Paginator {
  /**
   * 总条数
   */
  total: number
  /**
   * 一页多少条
   */
  size: number
  /**
   * 当前页
   */
  currentPage: number
  /**
   * 总页数
   */
  totalPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

@modelOptions({
  schemaOptions: { _id: false },
})
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

@modelOptions({
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: null,
    },
  },
})
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
  images?: Image[]

  @prop({ default: null })
  @ApiHideProperty()
  modified: Date | null

  static get protectedKeys() {
    return super.protectedKeys
  }
}

@modelOptions({
  schemaOptions: { id: false, _id: false },
  options: { customName: 'count' },
})
export class CountMixed {
  @prop({ default: 0 })
  read?: number

  @prop({ default: 0 })
  like?: number
}

export type { Image as TextImageRecordType }
