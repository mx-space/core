import { Transform } from 'class-transformer'
import { IsDate, IsOptional } from 'class-validator'

import { ApiProperty } from '@nestjs/swagger'

export class AnalyzeDto {
  @Transform(({ value: v }) => new Date(parseInt(v)))
  @IsOptional()
  @IsDate()
  @ApiProperty({ type: 'string' })
  from?: Date

  @Transform(({ value: v }) => new Date(parseInt(v)))
  @IsOptional()
  @IsDate()
  @ApiProperty({ type: 'string' })
  to?: Date
}
