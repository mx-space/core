import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'

import { BizException } from '~/common/exceptions/biz.exception'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { CommentRepository } from '~/modules/comment/comment.repository'
import { ConfigsService } from '~/modules/configs/configs.service'
import { ReaderRepository } from '~/modules/reader/reader.repository'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

import { FileReferenceService } from './file-reference.service'

@Injectable()
export class ReaderUploadQuotaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ReaderUploadQuotaInterceptor.name)

  constructor(
    private readonly readerRepository: ReaderRepository,
    private readonly commentRepository: CommentRepository,
    private readonly fileReferenceService: FileReferenceService,
    private readonly configsService: ConfigsService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = getNestExecutionContextRequest(context)
    const readerId = request.readerId || request.user?.id

    if (!readerId) {
      throw new BizException(ErrorCodeEnum.AuthNotLoggedIn)
    }

    if (request.user?.role === 'owner') {
      return next.handle()
    }

    const config = await this.configsService.get('commentUploadOptions')

    const minAccountAgeHours = config.readerMinAccountAgeHours ?? 0
    if (minAccountAgeHours > 0) {
      const reader = await this.readerRepository.findById(readerId)
      const createdAt = reader?.createdAt ? new Date(reader.createdAt) : null
      if (
        !createdAt ||
        Date.now() - createdAt.getTime() < minAccountAgeHours * 60 * 60 * 1000
      ) {
        throw new BizException(ErrorCodeEnum.CommentUploadAccountTooNew)
      }
    }

    const minCommentCount = config.readerMinCommentCount ?? 0
    if (minCommentCount > 0) {
      const count = await this.commentRepository.countActiveByReader(readerId)
      if (count < minCommentCount) {
        throw new BizException(ErrorCodeEnum.CommentUploadInsufficientComments)
      }
    }

    const hourlyLimit = config.readerHourlyUploadCount ?? 10
    if (hourlyLimit > 0) {
      const since = new Date(Date.now() - 60 * 60 * 1000)
      const count = await this.fileReferenceService.countReaderUploadsSince(
        readerId,
        since,
      )
      if (count >= hourlyLimit) {
        throw new BizException(ErrorCodeEnum.CommentUploadRateLimited)
      }
    }

    const totalBytesLimitMB = config.readerTotalActiveBytesMB ?? 50
    if (totalBytesLimitMB > 0) {
      const totalBytes =
        await this.fileReferenceService.sumReaderActiveBytes(readerId)
      if (totalBytes >= totalBytesLimitMB * 1024 * 1024) {
        throw new BizException(ErrorCodeEnum.CommentUploadQuotaExceeded)
      }
    }

    return next.handle()
  }
}
