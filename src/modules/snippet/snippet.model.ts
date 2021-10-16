import { index, modelOptions, prop } from '@typegoose/typegoose'
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { BaseModel } from '~/shared/model/base.model'

export enum SnippetType {
  JSON = 'json',
  Function = 'function',
  Text = 'text',
}

@modelOptions({
  options: {
    customName: 'snippet',
  },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
@index({ name: 1, reference: 1 })
@index({ type: 1 })
export class SnippetModel extends BaseModel {
  @prop({ type: SnippetType, default: SnippetType['JSON'] })
  @IsEnum(SnippetType)
  type: SnippetType

  @prop({ default: false })
  @IsBoolean()
  @IsOptional()
  private: boolean

  @prop({ require: true })
  @IsString()
  @IsNotEmpty()
  raw: string

  @prop({ require: true, trim: true })
  @IsString()
  @IsNotEmpty()
  name: string

  // 适用于
  @prop({ default: 'root' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  reference: string

  // 注释
  @prop({})
  @IsString()
  @IsOptional()
  comment?: string

  // 类型注释
  @prop({ maxlength: 20 })
  @MaxLength(20)
  @IsString()
  @IsOptional()
  metatype?: string
}
