import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { PagerDto } from '../../shared/dto/pager.dto'

export class SearchDto extends PagerDto {
  @IsNotEmpty()
  @IsString()
  keyword: string

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  orderBy: string

  @Transform(({ value: val }) => Number.parseInt(val))
  @IsEnum([1, -1])
  @IsOptional()
  order: number

  @IsOptional()
  @IsIn([0, 1])
  // HINT: only string type in query params
  @Transform(({ value }) => (value === 'true' || value === '1' ? 1 : 0))
  rawAlgolia?: boolean
}
