import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsString, Min, ValidateIf } from 'class-validator'

export class LogQueryDto {
  @IsIn(['out', 'error'])
  @ValidateIf((o: LogQueryDto) => typeof o.filename === 'undefined')
  type?: 'out' | 'error'
  @IsInt()
  @Min(0)
  @Transform(({ value }) => +value)
  @ValidateIf((o: LogQueryDto) => typeof o.filename === 'undefined')
  index: number

  @IsString()
  filename: string
}

export class LogTypeDto {
  @IsIn(['pm2', 'native'])
  type: 'pm2' | 'native'
}
