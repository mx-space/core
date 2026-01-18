import { PartialType } from '@nestjs/mapped-types'
import { PagerDto } from '~/shared/dto/pager.dto'
import { ImageModel } from '~/shared/model/image.model'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { DraftRefType } from './draft.model'

export class CreateDraftDto {
  @IsEnum(DraftRefType)
  refType: DraftRefType

  @IsOptional()
  @IsMongoId()
  refId?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  text?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageModel)
  @IsArray()
  images?: ImageModel[]

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>

  @IsOptional()
  @IsObject()
  typeSpecificData?: Record<string, any>
}

export class UpdateDraftDto extends PartialType(CreateDraftDto) {}

export class DraftPagerDto extends PagerDto {
  @IsOptional()
  @IsEnum(DraftRefType)
  refType?: DraftRefType

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  hasRef?: boolean
}

export class DraftRefTypeDto {
  @IsEnum(DraftRefType)
  refType: DraftRefType
}

export class DraftRefTypeAndIdDto extends DraftRefTypeDto {
  @IsMongoId()
  refId: string
}

export class RestoreVersionDto {
  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number.parseInt(value))
  version: number
}
