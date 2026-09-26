import { Get, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common'
import {
  FileInterceptor,
  type UploadedMultipartFile,
} from '@nestjs/platform-fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { ReaderAuth } from '~/common/decorators/reader-auth.decorator'
import { AppErrorCode, createAppException } from '~/common/errors'
import { requiredFilePipe } from '~/common/pipes/required-file.pipe'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'

import { CommentUploadService } from './comment-upload.service'
import { ReaderUploadQuotaInterceptor } from './reader-upload-quota.interceptor'

@ApiController('comments/uploads')
export class CommentUploadController {
  constructor(private readonly commentUploadService: CommentUploadService) {}

  @Get('/config')
  async getConfig() {
    return this.commentUploadService.getPublicConfig()
  }

  @Post('/')
  @ReaderAuth()
  @UseInterceptors(
    ReaderUploadQuotaInterceptor,
    FileInterceptor('file', {
      limits: (req: FastifyBizRequest) => ({
        fileSize: req.commentUploadMaxFileSize!,
      }),
    }),
  )
  async upload(
    @Req() req: FastifyBizRequest,
    @UploadedFile(requiredFilePipe) file: UploadedMultipartFile,
  ) {
    const readerId = req.readerId || req.user?.id
    if (!readerId) {
      throw createAppException(AppErrorCode.FILE_UPLOAD_NOT_AUTHORIZED)
    }
    return this.commentUploadService.uploadForReader(file, readerId)
  }
}
