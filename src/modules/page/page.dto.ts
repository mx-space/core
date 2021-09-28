import { Transform } from 'class-transformer'
import { IsEnum, IsOptional, ValidateIf } from 'class-validator'
import { PagerDto } from '~/shared/dto/pager.dto'

export class PageQueryDto extends PagerDto {
  @IsOptional()
  @IsEnum(['title', 'created', 'modified', 'order', 'subtitle'])
  readonly sortBy?: string

  @IsOptional()
  @IsEnum([1, -1])
  @ValidateIf((o) => o.sortBy)
  @Transform(({ value: v }) => v | 0)
  readonly sortOrder?: 1 | -1
}
