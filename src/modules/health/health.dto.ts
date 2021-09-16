import { Transform } from 'class-transformer'
import { IsIn, IsInt, Min } from 'class-validator'

export class PM2QueryDto {
  @IsIn(['out', 'error'])
  type: 'out' | 'error'
  @IsInt()
  @Min(0)
  @Transform(({ value }) => +value)
  index: number
}
