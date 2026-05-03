import type { BaseModel } from '~/shared/types/legacy-model.type'

import type {
  FileReferenceStatus,
  FileReferenceType,
} from './file-reference.enum'

export interface FileReferenceModel extends BaseModel {
  fileUrl: string
  fileName: string
  status: FileReferenceStatus
  refId?: string
  refType?: FileReferenceType
  s3ObjectKey?: string
}
