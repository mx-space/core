import { ApiProperty } from '@nestjs/swagger'
import { modelOptions, prop } from '@typegoose/typegoose'
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator'
import { range } from 'lodash'
import { BaseModel } from '~/shared/model/base.model'

export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
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

  @prop({ required: true, trim: true, unique: true })
  @IsUrl({ require_protocol: true })
  url: string

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @prop({ trim: true })
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
  @IsBoolean()
  @prop({ default: LinkState.Pass })
  state: LinkState

  @prop()
  @IsEmail()
  email?: string
  get hide() {
    return this.state === LinkState.Audit
  }
}
