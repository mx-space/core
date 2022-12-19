import { Transform } from 'class-transformer'
import { IsEnum } from 'class-validator'

export enum RecentlyAttitudeEnum {
  Up,
  Down,
}

export class RecentlyAttitudeDto {
  @IsEnum(RecentlyAttitudeEnum)
  @Transform(({ value }) => +value)
  attitude: RecentlyAttitudeEnum
}
