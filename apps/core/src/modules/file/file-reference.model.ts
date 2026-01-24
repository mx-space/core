import { index, modelOptions, prop, Severity } from '@typegoose/typegoose'
import { FILE_REFERENCE_COLLECTION_NAME } from '~/constants/db.constant'
import { BaseModel } from '~/shared/model/base.model'

export enum FileReferenceStatus {
  Pending = 'pending',
  Active = 'active',
}

export enum FileReferenceType {
  Post = 'post',
  Note = 'note',
  Page = 'page',
  Draft = 'draft',
}

@index({ fileUrl: 1 })
@index({ refId: 1, refType: 1 })
@index({ status: 1, created: 1 })
@modelOptions({
  options: {
    customName: FILE_REFERENCE_COLLECTION_NAME,
    allowMixed: Severity.ALLOW,
  },
})
export class FileReferenceModel extends BaseModel {
  @prop({ required: true, index: true })
  fileUrl!: string

  @prop({ required: true })
  fileName!: string

  @prop({ enum: FileReferenceStatus, default: FileReferenceStatus.Pending })
  status!: FileReferenceStatus

  @prop({ type: String })
  refId?: string

  @prop({ enum: FileReferenceType })
  refType?: FileReferenceType
}
