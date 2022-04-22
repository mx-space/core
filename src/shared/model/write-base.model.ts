import { Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { ApiHideProperty } from '@nestjs/swagger'
import { PropType, prop } from '@typegoose/typegoose'

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
  @ApiHideProperty()
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageModel)
  images?: ImageModel[]

  @prop({ default: null, type: Date })
  @ApiHideProperty()
  modified: Date | null

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
