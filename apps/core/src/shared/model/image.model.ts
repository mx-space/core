import { modelOptions, prop } from '@typegoose/typegoose'
import {
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator'

@modelOptions({
  schemaOptions: { _id: false },
})
export abstract class ImageModel {
  @prop()
  @IsOptional()
  @IsNumber()
  width?: number

  @prop()
  @IsOptional()
  @IsNumber()
  height?: number

  @prop()
  @IsOptional()
  @IsHexColor()
  accent?: string

  @prop()
  @IsString()
  @IsOptional()
  type?: string

  @prop()
  @IsOptional()
  @IsUrl()
  src?: string

  @prop()
  @IsOptional()
  @IsString()
  blurHash?: string
}
