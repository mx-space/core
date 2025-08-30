import { PagerDto } from '~/shared/dto/pager.dto'
import { Transform, Type } from 'class-transformer'
import { IsEnum, IsInt, IsNumber, IsOptional } from 'class-validator'
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

export class ActivityRangeDto {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  start: number

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  end: number
}

export class ActivityNotificationDto {
  @IsInt()
  @Type(() => Number)
  from: number
}
