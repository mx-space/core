import { Global, Module } from '@nestjs/common'

import { CommentUploadController } from './comment-upload.controller'
import { CommentUploadService } from './comment-upload.service'
import { FileController } from './file.controller'
import { FileService } from './file.service'
import { FileReferenceService } from './file-reference.service'
import { ReaderUploadQuotaInterceptor } from './reader-upload-quota.interceptor'

@Global()
@Module({
  controllers: [FileController, CommentUploadController],
  providers: [
    FileService,
    FileReferenceService,
    CommentUploadService,
    ReaderUploadQuotaInterceptor,
  ],
  exports: [FileService, FileReferenceService, CommentUploadService],
})
export class FileModule {}
