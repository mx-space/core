import { index, modelOptions, plugin, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { EncryptUtil } from '~/utils/encrypt.util'
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
import { isNil } from 'lodash'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import { stringify } from 'qs'

export enum SnippetType {
  JSON = 'json',
  JSON5 = 'json5',
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
@plugin(aggregatePaginate)
@index({ name: 1, reference: 1 })
@index({ type: 1 })
export class SnippetModel extends BaseModel {
  @prop({ default: SnippetType.JSON })
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
  @Matches(/^[\w-]{1,30}$/, {
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

  // 元数据类型（预留二级类型，暂时不用）
  @prop({ maxlength: 20 })
  @MaxLength(20)
  @IsString()
  @IsOptional()
  metatype?: string

  @prop()
  @IsString()
  @IsOptional()
  schema?: string

  // for function start
  @prop()
  @IsEnum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'])
  @IsOptional()
  method?: string

  @prop({
    select: false,
    get(val) {
      return EncryptUtil.decrypt(val)
    },
    set(val) {
      return EncryptUtil.encrypt(val)
    },
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (isNil(value) ? value : stringify(value)))
  // username=123&password=123
  secret?: string
  // for function end

  @prop()
  @IsBoolean()
  @IsOptional()
  enable?: boolean

  updated?: string

  @prop({
    default: false,
  })
  builtIn?: boolean
}
