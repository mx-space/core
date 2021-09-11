import { IsEnum, IsString } from 'class-validator'
import { ReplyMailType } from '~/processors/helper/helper.email.service'

export class ReplyEmailTypeDto {
  @IsEnum(ReplyMailType)
  type: ReplyMailType
}

export class ReplyEmailBodyDto {
  @IsString()
  source: string
}
