import { IsString } from 'class-validator'
import type {
  NewsletterMailType,
  ReplyMailType,
} from '~/processors/helper/helper.email.service'

export class EmailTemplateTypeDto {
  @IsString()
  type: ReplyMailType | NewsletterMailType
}

export class ReplyEmailBodyDto {
  @IsString()
  source: string
}
