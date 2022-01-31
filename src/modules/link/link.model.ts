import { ApiProperty } from '@nestjs/swagger'
import { modelOptions, prop } from '@typegoose/typegoose'
import { Transform } from 'class-transformer'
import { IsEmail, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator'
import { range } from 'lodash'
import { URL } from 'url'
import { BaseModel } from '~/shared/model/base.model'

export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
  Outdate,
  Banned,
}
/**
 * Link Model also used to validate dto
 */
@modelOptions({ options: { customName: 'Link' } })
export class LinkModel extends BaseModel {
  @prop({ required: true, trim: true, unique: true })
  @IsString()
  /**
   * name is site name
   */
  name: string

  @prop({
    required: true,
    trim: true,
    unique: true,
    set(val) {
      return new URL(val).origin
    },
  })
  @IsUrl(
    { require_protocol: true, protocols: ['https'] },
    { message: 'only https protocol support' },
  )
  url: string

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @prop({ trim: true })
  // 对空字符串处理
  @Transform(({ value }) => (value === '' ? null : value))
  avatar?: string

  @IsOptional()
  @IsString()
  @prop({ trim: true })
  description?: string

  @IsOptional()
  @IsEnum(LinkType)
  @ApiProperty({ enum: range(0, 1) })
  @prop({ default: LinkType.Friend })
  type?: LinkType

  @IsOptional()
  @IsEnum(LinkState)
  @prop({ default: LinkState.Pass })
  state: LinkState

  @prop()
  @IsEmail()
  @IsOptional()
  // 对空字符串处理
  @Transform(({ value }) => (value === '' ? null : value))
  email?: string
  get hide() {
    return this.state === LinkState.Audit
  }
  set hide(value) {
    return
  }
}
