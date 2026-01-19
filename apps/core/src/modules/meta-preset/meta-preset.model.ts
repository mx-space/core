import { modelOptions, prop, Severity } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Schema } from 'mongoose'

/**
 * 元数据字段类型枚举
 */
export enum MetaFieldType {
  Text = 'text',
  Textarea = 'textarea',
  Number = 'number',
  Url = 'url',
  Select = 'select',
  MultiSelect = 'multi-select',
  Checkbox = 'checkbox',
  Tags = 'tags',
  Boolean = 'boolean',
  Object = 'object',
}

/**
 * 适用范围枚举
 */
export enum MetaPresetScope {
  Post = 'post',
  Note = 'note',
  Both = 'both',
}

/**
 * 字段选项（嵌入式）
 */
export class MetaFieldOption {
  @prop({ type: Schema.Types.Mixed, required: true })
  @IsNotEmpty()
  value!: any

  @prop({ required: true })
  @IsString()
  @IsNotEmpty()
  label!: string

  @prop({ default: false })
  @IsOptional()
  @IsBoolean()
  exclusive?: boolean
}

/**
 * 子字段定义（用于 object 类型）
 */
export class MetaPresetChild {
  @prop({ required: true })
  @IsString()
  @IsNotEmpty()
  key!: string

  @prop({ required: true })
  @IsString()
  @IsNotEmpty()
  label!: string

  @prop({ required: true, enum: MetaFieldType })
  @IsEnum(MetaFieldType)
  type!: MetaFieldType

  @prop()
  @IsOptional()
  @IsString()
  description?: string

  @prop()
  @IsOptional()
  @IsString()
  placeholder?: string

  @prop({ type: () => [MetaFieldOption], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetaFieldOption)
  options?: MetaFieldOption[]
}

/**
 * 元数据预设字段模型
 */
@modelOptions({
  options: { allowMixed: Severity.ALLOW, customName: 'MetaPreset' },
  schemaOptions: {
    timestamps: {
      createdAt: 'created',
      updatedAt: 'updated',
    },
  },
})
export class MetaPresetModel extends BaseModel {
  @prop({ required: true, unique: true })
  @IsString()
  @IsNotEmpty()
  key!: string

  @prop({ required: true })
  @IsString()
  @IsNotEmpty()
  label!: string

  @prop({ required: true, enum: MetaFieldType })
  @IsEnum(MetaFieldType)
  type!: MetaFieldType

  @prop()
  @IsOptional()
  @IsString()
  description?: string

  @prop()
  @IsOptional()
  @IsString()
  placeholder?: string

  @prop({
    required: true,
    enum: MetaPresetScope,
    default: MetaPresetScope.Both,
  })
  @IsEnum(MetaPresetScope)
  scope!: MetaPresetScope

  @prop({ type: () => [MetaFieldOption], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetaFieldOption)
  options?: MetaFieldOption[]

  @prop({ default: false })
  @IsOptional()
  @IsBoolean()
  allowCustomOption?: boolean

  @prop({ type: () => [MetaPresetChild], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetaPresetChild)
  children?: MetaPresetChild[]

  @prop({ default: false })
  @IsBoolean()
  isBuiltin!: boolean

  @prop({ default: 0 })
  @IsNumber()
  order!: number

  @prop({ default: true })
  @IsBoolean()
  enabled!: boolean

  updated?: Date
}
