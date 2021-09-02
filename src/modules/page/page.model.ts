import { ApiProperty } from '@nestjs/swagger'
import { modelOptions, prop } from '@typegoose/typegoose'
import { Transform } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { Schema } from 'mongoose'
import { WriteBaseModel } from '~/shared/model/base.model'
import { IsNilOrString } from '~/utils/validator/isNilOrString'

export const pageType = ['md', 'html', 'frame']

@modelOptions({
  options: {
    customName: 'Page',
  },
})
export class PageModel extends WriteBaseModel {
  @ApiProperty({ description: 'Slug', required: true })
  @prop({ trim: 1, index: true, required: true, unique: true })
  @IsString()
  @IsNotEmpty()
  slug!: string

  @ApiProperty({ description: 'SubTitle', required: false })
  @prop({ trim: true })
  @IsString()
  @IsOptional()
  @IsNilOrString()
  subtitle?: string | null

  @ApiProperty({ description: 'Order', required: false })
  @prop({ default: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  order!: number

  @ApiProperty({
    description: 'Type (MD | html | frame)',
    enum: pageType,
    required: false,
  })
  @prop({ default: 'md' })
  @IsEnum(pageType)
  @IsOptional()
  type?: string

  @ApiProperty({ description: 'Other Options', required: false })
  @prop({ type: Schema.Types.Mixed })
  @IsOptional()
  @IsObject()
  options?: Record<string, any>
}
