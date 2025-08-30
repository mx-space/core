import type { DocumentType } from '@typegoose/typegoose'
import { modelOptions, prop, Severity } from '@typegoose/typegoose'
import { USER_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { hashSync } from 'bcryptjs'
import { omit } from 'lodash'
import { Schema } from 'mongoose'

export type UserDocument = DocumentType<UserModel>

export class OAuthModel {
  @prop()
  platform: string
  @prop()
  id: string
}

export class TokenModel {
  _id?: string
  @prop()
  created: Date

  @prop()
  token: string

  @prop()
  expired?: Date

  @prop({ unique: true })
  name: string
}

const securityKeys = [
  'oauth2',
  'apiToken',
  'lastLoginTime',
  'lastLoginIp',
  'password',
] as const
@modelOptions({
  options: { customName: USER_COLLECTION_NAME, allowMixed: Severity.ALLOW },
})
export class UserModel extends BaseModel {
  @prop({ required: true, unique: true, trim: true })
  username!: string

  @prop({ trim: true })
  name!: string

  @prop()
  introduce?: string

  @prop()
  avatar?: string

  @prop({
    select: false,
    get(val) {
      return val
    },
    set(val) {
      return hashSync(val, 6)
    },
    required: true,
  })
  password!: string

  @prop()
  mail: string

  @prop()
  url?: string

  @prop()
  lastLoginTime?: Date

  @prop({ select: false })
  lastLoginIp?: string

  @prop({ type: Schema.Types.Mixed })
  socialIds?: any

  @prop({ type: TokenModel, select: false })
  apiToken?: TokenModel[]

  @prop({ type: OAuthModel, select: false })
  oauth2?: OAuthModel[]

  static securityKeys = securityKeys

  static serialize(doc: UserModel) {
    return omit(doc, this.securityKeys)
  }
}

type ReadonlyArrayToUnion<T extends readonly any[]> = T[number]

export type UserModelSecurityKeys = ReadonlyArrayToUnion<typeof securityKeys>
