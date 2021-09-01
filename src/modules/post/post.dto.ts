import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator'
import { PagerDto } from '~/shared/dto/pager.dto'

export class PostQueryDto extends PagerDto {
  @IsOptional()
  @IsEnum(['categoryId', 'title', 'created', 'modified'])
  @Transform(({ value: v }) => (v === 'category' ? 'categoryId' : v))
  sortBy?: string

  @IsOptional()
  @IsEnum([1, -1])
  @ValidateIf((o) => o.sortBy)
  @Transform(({ value: v }) => v | 0)
  sortOrder?: 1 | -1
}

export class CategoryAndSlug {
  @ApiProperty({ example: 'Z-Turn' })
  @IsString()
  readonly category: string

  @IsString()
  @ApiProperty({ example: 'why-winserver' })
  @Transform(({ value: v }) => decodeURI(v))
  readonly slug: string
}
