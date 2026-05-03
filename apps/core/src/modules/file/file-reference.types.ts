import type {
  FileReferenceStatus,
  FileReferenceType,
} from './file-reference.enum'

export { FileReferenceStatus, FileReferenceType } from './file-reference.enum'

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

export interface FileReferenceRow {
  id: string
  fileUrl: string
  fileName: string
  status: FileReferenceStatus
  refId: string | null
  refType: FileReferenceType | null
  s3ObjectKey: string | null
  readerId: string | null
  uploadedBy: FileUploadedBy | null
  mimeType: string | null
  byteSize: number | null
  detachedAt: Date | null
  createdAt: Date
}
