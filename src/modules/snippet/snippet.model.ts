import { index, modelOptions, prop } from '@typegoose/typegoose'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'
import { BaseModel } from '~/shared/model/base.model'

export enum SnippetType {
  JSON = 'json',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
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
  @prop({ default: SnippetType['JSON'] })
  @IsEnum(SnippetType)
  type: SnippetType

  @prop({ default: false })
  @IsBoolean()
  @IsOptional()
  private: boolean

  @prop({ require: true })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value.trim())
  raw: string

  @prop({ require: true, trim: true })
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]{1,30}$/, {
    message: 'name 只能使用英文字母和数字下划线且不超过 30 个字符',
  })
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
