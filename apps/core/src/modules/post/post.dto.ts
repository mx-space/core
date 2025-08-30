import { PagerDto } from '~/shared/dto/pager.dto'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator'

export class CategoryAndSlugDto {
  @IsString()
  readonly category: string

  @IsString()
  @Transform(({ value: v }) => decodeURI(v))
  readonly slug: string
}

export class PostPagerDto extends PagerDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  truncate?: number
}

export class SetPostPublishStatusDto {
  @IsBoolean()
  isPublished: boolean
}
