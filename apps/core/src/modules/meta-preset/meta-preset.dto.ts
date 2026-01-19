import { PartialType } from '@nestjs/mapped-types'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import {
  MetaFieldOption,
  MetaFieldType,
  MetaPresetChild,
  MetaPresetScope,
} from './meta-preset.model'

/**
 * 创建预设字段 DTO
 */
export class CreateMetaPresetDto {
  @IsString()
  @IsNotEmpty()
  key!: string

  @IsString()
  @IsNotEmpty()
  label!: string

  @IsEnum(MetaFieldType)
  type!: MetaFieldType

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  placeholder?: string

  @IsOptional()
  @IsEnum(MetaPresetScope)
  scope?: MetaPresetScope

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetaFieldOption)
  options?: MetaFieldOption[]

  @IsOptional()
  @IsBoolean()
  allowCustomOption?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetaPresetChild)
  children?: MetaPresetChild[]

  @IsOptional()
  @IsNumber()
  order?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

/**
 * 更新预设字段 DTO
 */
export class UpdateMetaPresetDto extends PartialType(CreateMetaPresetDto) {}

/**
 * 查询预设字段 DTO
 */
export class QueryMetaPresetDto {
  @IsOptional()
  @IsEnum(MetaPresetScope)
  scope?: MetaPresetScope

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enabledOnly?: boolean
}

/**
 * 批量更新排序 DTO
 */
export class UpdateOrderDto {
  @IsArray()
  @IsMongoId({ each: true })
  ids!: string[]
}
