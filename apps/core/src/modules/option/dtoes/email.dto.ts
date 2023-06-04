import { IsString } from 'class-validator'

export class EmailTemplateTypeDto {
  @IsString()
  type: string
}

export class EmailTemplateBodyDto {
  @IsString()
  source: string
}
