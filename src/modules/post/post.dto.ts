import { Transform } from 'class-transformer'
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator'
import { PagerDto } from '~/shared/dto/pager.dto'

export class PostQueryDto extends PagerDto {
  @IsOptional()
  @IsEnum(['categoryId', 'title', 'created', 'modified'])
  @Transform(({ value: v }) => (v === 'category' ? 'categoryId' : v))
  readonly sortBy?: string

  @IsOptional()
  @IsEnum([1, -1])
  @ValidateIf((o) => o.sortBy)
  @Transform(({ value: v }) => v | 0)
  readonly sortOrder?: 1 | -1
}

export class CategoryAndSlugDto {
  @IsString()
  readonly category: string

  @IsString()
  @Transform(({ value: v }) => decodeURI(v))
  readonly slug: string
}
