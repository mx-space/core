import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class TopQueryDto {
  @Transform(({ value: val }) => Number.parseInt(val))
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
  sort?: -1 | 1

  @Transform(({ value: val }) => Number(val))
  @IsInt()
  @IsOptional()
  year?: number

  @IsEnum(TimelineType)
  @IsOptional()
  @Transform(({ value: v }) => Math.trunc(v))
  type?: TimelineType
}

export class AggregateQueryDto {
  @IsString()
  @IsOptional()
  theme?: string
}

export enum ReadAndLikeCountDocumentType {
  Post,
  Note,
  All,
}

export class ReadAndLikeCountTypeDto {
  @IsEnum(ReadAndLikeCountDocumentType)
  @IsOptional()
  @Transform(({ value: v }) => Math.trunc(v))
  type?: ReadAndLikeCountDocumentType
}
