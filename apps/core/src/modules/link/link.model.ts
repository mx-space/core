import { modelOptions, prop } from '@typegoose/typegoose'
import { BaseModel } from '~/shared/model/base.model'
import { Transform } from 'class-transformer'
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator'

export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
  Outdate,
  Banned,
  Reject,
}

export const LinkStateMap = {
  [LinkState.Pass]: '已通过',
  [LinkState.Audit]: '审核中',
  [LinkState.Outdate]: '已过期',
  [LinkState.Banned]: '已屏蔽',
  [LinkState.Reject]: '已拒绝',
}

/**
 * Link Model also used to validate dto
 */
@modelOptions({ options: { customName: 'Link' } })
export class LinkModel extends BaseModel {
  @prop({ required: true, trim: true, unique: true })
  @IsString({ message: '标题是必须的啦' })
  @MaxLength(20, { message: '标题太长了 www' })
  /**
   * name is site name
   */
  name: string

  @prop({
    required: true,
    trim: true,
    unique: true,
  })
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    { message: '只有 HTTPS 被允许哦' },
  )
  url: string

  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    { message: '只有 HTTPS 被允许哦' },
  )
  @prop({ trim: true })
  // 对空字符串处理
  @Transform(({ value }) => (value === '' ? null : value))
  @MaxLength(200)
  avatar?: string

  @IsOptional()
  @IsString()
  @prop({ trim: true })
  @MaxLength(50, { message: '描述信息超过 50 会坏掉的！' })
  description?: string

  @IsOptional()
  @IsEnum(LinkType)
  @prop({ default: LinkType.Friend })
  type?: LinkType

  @IsOptional()
  @IsEnum(LinkState)
  @prop({ default: LinkState.Pass })
  state: LinkState

  @prop()
  @IsEmail(undefined, { message: '请输入正确的邮箱！' })
  @IsOptional()
  // 对空字符串处理
  @Transform(({ value }) => (value === '' ? null : value))
  @MaxLength(50)
  email?: string
  get hide() {
    return this.state === LinkState.Audit
  }
  set hide(value) {
    return
  }
}
