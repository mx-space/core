import { Global, Module } from '@nestjs/common'

import { CommentModule } from '../comment/comment.module'
import { CommentUploadController } from './comment-upload.controller'
import { CommentUploadService } from './comment-upload.service'
import { FileController } from './file.controller'
import { FileService } from './file.service'
import { FileReferenceRepository } from './file-reference.repository'
import { FileReferenceService } from './file-reference.service'
import { ReaderUploadQuotaInterceptor } from './reader-upload-quota.interceptor'

@Global()
@Module({
  imports: [CommentModule],
  controllers: [FileController, CommentUploadController],
  providers: [
    FileService,
    FileReferenceService,
    FileReferenceRepository,
    CommentUploadService,
    ReaderUploadQuotaInterceptor,
  ],
  exports: [FileService, FileReferenceService, CommentUploadService],
})
export class FileModule {}
