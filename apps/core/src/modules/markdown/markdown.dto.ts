import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { ArticleTypeEnum } from '~/constants/article.constant'

export class MetaDto {
  @IsString()
  title: string

  @Transform(({ value: v }) => new Date(v))
  @IsDate()
  date: Date

  @Transform(({ value: v }) => new Date(v))
  @IsDate()
  @IsOptional()
  updated?: Date

  @IsString({ each: true })
  @IsOptional()
  categories?: Array<string>

  @IsString({ each: true })
  @IsOptional()
  tags?: string[]

  @IsString()
  slug: string
}

export class DatatypeDto {
  @ValidateNested()
  @IsOptional()
  @Type(() => MetaDto)
  meta: MetaDto

  @IsString()
  text: string
}

export class DataListDto {
  @IsEnum(ArticleTypeEnum)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  type: ArticleTypeEnum
  @ValidateNested({ each: true })
  @Type(() => DatatypeDto)
  data: DatatypeDto[]
}

export class ExportMarkdownQueryDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === '1' || value === 'true')
  yaml: boolean

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === '1' || value === 'true')
  slug: boolean

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === '1' || value === 'true')
  show_title: boolean
}

export class MarkdownPreviewDto {
  @IsString()
  title: string
  @IsString()
  md: string
}
