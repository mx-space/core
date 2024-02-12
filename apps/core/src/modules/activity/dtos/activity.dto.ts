import { Transform } from 'class-transformer'
import { IsEnum, IsNumber, IsOptional } from 'class-validator'

import { PagerDto } from '~/shared/dto/pager.dto'

import { Activity } from '../activity.constant'

const TransformEnum = () =>
  Transform(({ value }) => (typeof value === 'undefined' ? value : +value))

export class ActivityTypeParamsDto {
  @IsEnum(Activity)
  @TransformEnum()
  type: Activity
}

export class ActivityDeleteDto {
  @IsNumber()
  @IsOptional()
  before?: number
}

export class ActivityQueryDto extends PagerDto {
  @IsEnum(Activity)
  @IsOptional()
  @TransformEnum()
  type: Activity
}
