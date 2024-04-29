import { Expose, Transform } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator'

class DbQueryDto {
  @IsOptional()
  db_query?: any
}
export class PagerDto extends DbQueryDto {
  @Min(1)
  @Max(50)
  @IsInt()
  @Expose()
  @Transform(({ value: val }) => (val ? Number.parseInt(val) : 10), {
    toClassOnly: true,
  })
  size: number

  @Transform(({ value: val }) => (val ? Number.parseInt(val) : 1), {
    toClassOnly: true,
  })
  @Min(1)
  @IsInt()
  @Expose()
  page: number

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  select?: string

  @IsOptional()
  @IsString()
  sortBy?: string

  @IsOptional()
  @IsEnum([1, -1])
  @Transform(({ value: val }) => {
    // @ts-ignore
    const isStringNumber = typeof val === 'string' && !Number.isNaN(val)

    if (isStringNumber) {
      return Number.parseInt(val)
    } else {
      return {
        asc: 1,
        desc: -1,
      }[val.toString()]
    }
  })
  sortOrder?: 1 | -1

  @IsOptional()
  @Transform(({ value: val }) => Number.parseInt(val))
  @Min(1)
  @IsInt()
  year?: number

  @IsOptional()
  @Transform(({ value: val }) => Number.parseInt(val))
  @IsInt()
  state?: number
}

export class OffsetDto {
  @IsMongoId()
  @IsOptional()
  before?: string

  @IsMongoId()
  @IsOptional()
  @ValidateIf((o) => {
    return typeof o.before !== 'undefined'
  })
  after?: string

  @Transform(({ value }) => +value)
  @IsInt()
  @IsOptional()
  @Max(50)
  size?: number
}
