import type { DocumentType } from '@typegoose/typegoose'
import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { OWNER_PROFILE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'
import { Schema, Types } from 'mongoose'

export type OwnerProfileDocument = DocumentType<OwnerProfileModel>

@index({ readerId: 1 }, { unique: true })
@modelOptions({
  options: {
    customName: OWNER_PROFILE_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
export class OwnerProfileModel extends BaseModel {
  @prop({ required: true, type: Schema.Types.ObjectId })
  readerId!: Types.ObjectId

  @prop()
  mail?: string

  @prop()
  url?: string

  @prop()
  introduce?: string

  @prop({ select: false })
  lastLoginIp?: string

  @prop()
  lastLoginTime?: Date

  @prop({ type: Schema.Types.Mixed })
  socialIds?: Record<string, any>
}
