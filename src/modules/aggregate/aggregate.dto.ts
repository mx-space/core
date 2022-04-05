import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'

export class TopQueryDto {
  @Transform(({ value: val }) => parseInt(val))
  @Min(1)
  @Max(10)
  @IsOptional()
  size?: number
}
export enum TimelineType {
  Post,
  Note,
}

export class TimelineQueryDto {
  @Transform(({ value: val }) => Number(val))
  @IsEnum([1, -1])
  @IsOptional()
  @ApiProperty({ enum: [-1, 1] })
  sort?: -1 | 1

  @Transform(({ value: val }) => Number(val))
  @IsInt()
  @IsOptional()
  year?: number

  @IsEnum(TimelineType)
  @IsOptional()
  @ApiProperty({ enum: [0, 1] })
  @Transform(({ value: v }) => v | 0)
  type?: TimelineType
}
