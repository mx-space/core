import { Transform } from 'class-transformer'
import { IsDate, IsOptional } from 'class-validator'

export class AnalyzeDto {
  @Transform(({ value: v }) => new Date(Number.parseInt(v)))
  @IsOptional()
  @IsDate()
  from?: Date

  @Transform(({ value: v }) => new Date(Number.parseInt(v)))
  @IsOptional()
  @IsDate()
  to?: Date
}
