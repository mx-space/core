import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'

import { FILE_REFERENCE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

export enum FileReferenceStatus {
  Pending = 'pending',
  Active = 'active',
  Detached = 'detached',
}

export enum FileReferenceType {
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Draft = 'draft',
  Comment = 'comment',
}

export enum FileUploadedBy {
  Owner = 'owner',
  Reader = 'reader',
}

export enum FileDeletionReason {
  PendingTtl = 'pending_ttl',
  DetachedTtl = 'detached_ttl',
  CommentDeleted = 'comment_deleted',
  CommentSpam = 'comment_spam',
  CascadePostDeleted = 'cascade_post_deleted',
  Manual = 'manual',
}

@index({ fileUrl: 1 })
@index({ refId: 1, refType: 1 })
@index({ status: 1, created: 1 })
@index({ readerId: 1, status: 1, created: 1 })
@index({ status: 1, detachedAt: 1 }, { sparse: true })
@modelOptions({
  options: {
    customName: FILE_REFERENCE_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
export class FileReferenceModel extends BaseModel {
  @prop({ required: true })
  fileUrl!: string

  @prop({ required: true })
  fileName!: string

  @prop({
    type: String,
    enum: FileReferenceStatus,
    default: FileReferenceStatus.Pending,
  })
  status!: FileReferenceStatus

  @prop({ type: String })
  refId?: string

  @prop({ type: String, enum: FileReferenceType })
  refType?: FileReferenceType

  @prop({ type: String })
  s3ObjectKey?: string

  @prop({ type: String })
  readerId?: string

  @prop({ type: String, enum: FileUploadedBy })
  uploadedBy?: FileUploadedBy

  @prop({ type: String })
  mimeType?: string

  @prop({ type: Number })
  byteSize?: number

  @prop({ type: Date })
  detachedAt?: Date
}
