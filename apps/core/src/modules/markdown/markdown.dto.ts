import { TransformBoolean } from '~/common/decorators/transform-boolean.decorator'
import { ArticleTypeEnum } from '~/constants/article.constant'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

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
  @TransformBoolean()
  yaml: boolean

  @IsBoolean()
  @IsOptional()
  @TransformBoolean()
  slug: boolean

  @IsBoolean()
  @IsOptional()
  @TransformBoolean()
  show_title: boolean

  @IsBoolean()
  @IsOptional()
  @TransformBoolean()
  with_meta_json: boolean
}

export class MarkdownPreviewDto {
  @IsString()
  title: string
  @IsString()
  md: string
}
