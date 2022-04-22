import { Transform } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

import { PartialType } from '@nestjs/mapped-types'
import { modelOptions, prop } from '@typegoose/typegoose'

import { WriteBaseModel } from '~/shared/model/write-base.model'
import { IsNilOrString } from '~/utils/validator/isNilOrString'

export enum PageType {
  'md' = 'md',
  'html' = 'html',
  'json' = 'json',
}

@modelOptions({
  options: {
    customName: 'Page',
  },
})
export class PageModel extends WriteBaseModel {
  @prop({ trim: 1, index: true, required: true, unique: true })
  @IsString()
  @IsNotEmpty()
  slug!: string

  @prop({ trim: true, type: String })
  @IsString()
  @IsOptional()
  @IsNilOrString()
  subtitle?: string | null

  @prop({ default: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  order!: number

  @prop({ default: 'md' })
  @IsEnum(PageType)
  @IsOptional()
  type?: string
}

export class PartialPageModel extends PartialType(PageModel) {}
