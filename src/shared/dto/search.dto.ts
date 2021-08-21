/*
 * @Author: Innei
 * @Date: 2020-04-30 12:21:51
 * @LastEditTime: 2020-08-02 16:27:30
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/shared/base/dto/search.dto.ts
 * @Coding with Love
 */

import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { PagerDto } from './pager.dto'

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
}
