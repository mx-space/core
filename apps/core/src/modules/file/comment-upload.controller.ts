import { Get, Post, Req, UseInterceptors } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { ReaderAuth } from '~/common/decorators/reader-auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
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
  @UseInterceptors(ReaderUploadQuotaInterceptor)
  async upload(@Req() req: FastifyRequest) {
    const bizReq = req as FastifyBizRequest
    const readerId = bizReq.readerId || bizReq.user?.id
    if (!readerId) {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }
    return this.commentUploadService.uploadForReader(req, readerId)
  }
}
