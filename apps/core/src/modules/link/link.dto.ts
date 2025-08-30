import { IsEnum, IsString, MaxLength } from 'class-validator'
import { LinkModel, LinkState } from './link.model'

export class LinkDto extends LinkModel {
  @IsString({ message: '输入你的大名吧' })
  @MaxLength(20, { message: '乃的名字太长了' })
  author: string
}

export class AuditReasonDto {
  @IsString({ message: '请输入审核理由' })
  reason: string

  @IsEnum(LinkState)
  state: LinkState
}
