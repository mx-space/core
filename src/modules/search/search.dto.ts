import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'

import { PagerDto } from '../../shared/dto/pager.dto'

export class SearchDto extends PagerDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  keyword: string

  @IsString()
  @ApiProperty({ description: '根据什么排序', required: false })
  @IsNotEmpty()
  @IsOptional()
  orderBy: string

  @Transform(({ value: val }) => parseInt(val))
  @IsEnum([1, -1])
  @IsOptional()
  @ApiProperty({ description: '倒序|正序', enum: [1, -1], required: false })
  order: number

  @IsOptional()
  @IsIn([0, 1])
  // HINT: only string type in query params
  @Transform(({ value }) => (value === 'true' || value === '1' ? 1 : 0))
  rawAlgolia?: boolean
}
