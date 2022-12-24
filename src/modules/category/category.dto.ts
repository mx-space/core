import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import { uniq } from 'lodash'

import { UnprocessableEntityException } from '@nestjs/common'
import { ApiProperty } from '@nestjs/swagger'

import { IsBooleanOrString } from '~/utils/validator/isBooleanOrString'

import { CategoryType } from './category.model'

export class SlugOrIdDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  query?: string
}

export class MultiQueryTagAndCategoryDto {
  @IsOptional()
  @Transform(({ value: val }) => {
    if (val === '1' || val === 'true') {
      return true
    } else {
      return val
    }
  })
  @IsBooleanOrString()
  tag?: boolean | string
}
export class MultiCategoriesQueryDto {
  @IsOptional()
  @IsMongoId({
    each: true,
    message: '多分类查询使用逗号分隔，应为 mongoID',
  })
  @Transform(({ value: v }) => uniq(v.split(',')))
  ids?: Array<string>

  @IsOptional()
  @IsBoolean()
  @Transform((b) => Boolean(b))
  @ApiProperty({ enum: [1, 0] })
  joint?: boolean

  @IsOptional()
  @Transform(({ value: v }: { value: string }) => {
    if (typeof v !== 'string') {
      throw new UnprocessableEntityException('type must be a string')
    }
    switch (v.toLowerCase()) {
      case 'category':
        return CategoryType.Category
      case 'tag':
        return CategoryType.Tag
      default:
        return Object.values(CategoryType).includes(+v)
          ? +v
          : CategoryType.Category
    }
  })
  type: CategoryType
}
