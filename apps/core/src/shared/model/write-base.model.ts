import { prop, PropType } from '@typegoose/typegoose'
import { Transform, Type } from 'class-transformer'
import {
  IsDate,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { BaseCommentIndexModel } from './base-comment.model'
import { ImageModel } from './image.model'

export class WriteBaseModel extends BaseCommentIndexModel {
  @prop({ trim: true, index: true, required: true })
  @IsString()
  @IsNotEmpty()
  title: string

  @prop({ trim: true })
  @IsString()
  text: string

  @prop({ type: ImageModel })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageModel)
  images?: ImageModel[]

  @prop({ default: null, type: Date })
  modified: Date | null

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @prop()
  declare created?: Date

  @prop(
    {
      type: String,

      get(jsonString) {
        return JSON.safeParse(jsonString)
      },
      set(val) {
        return JSON.stringify(val)
      },
    },
    PropType.NONE,
  )
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>

  static get protectedKeys() {
    return super.protectedKeys
  }
}
