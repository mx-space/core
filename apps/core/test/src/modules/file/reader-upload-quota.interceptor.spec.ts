import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { PayloadTooLargeException } from '@nestjs/common'
import { firstValueFrom, throwError } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorCode } from '~/common/errors'
import { ReaderUploadQuotaInterceptor } from '~/modules/file/reader-upload-quota.interceptor'
import type { FastifyBizRequest } from '~/transformers/get-req.transformer'

describe('ReaderUploadQuotaInterceptor', () => {
  it('rejects disabled uploads before parsing the multipart body', async () => {
    const request = {
      readerId: 'reader-1',
      user: { role: 'owner' },
    } as FastifyBizRequest
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext
    const handle = vi.fn()
    const interceptor = new ReaderUploadQuotaInterceptor(
      {} as never,
      {} as never,
      {} as never,
      { get: async () => ({ enable: false }) } as never,
    )

    await expect(
      interceptor.intercept(context, { handle } as unknown as CallHandler),
    ).rejects.toMatchObject({ code: AppErrorCode.COMMENT_UPLOAD_DISABLED })
    expect(handle).not.toHaveBeenCalled()
  })

  it('uses the configured upload limit and preserves the comment error code', async () => {
    const request = {
      readerId: 'reader-1',
      user: { role: 'owner' },
    } as FastifyBizRequest
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext
    const next = {
      handle: () => throwError(() => new PayloadTooLargeException()),
    } as CallHandler
    const interceptor = new ReaderUploadQuotaInterceptor(
      {} as never,
      {} as never,
      {} as never,
      { get: async () => ({ singleFileSizeMB: 7 }) } as never,
    )

    const response = await interceptor.intercept(context, next)

    expect(request.commentUploadMaxFileSize).toBe(7 * 1024 * 1024)
    await expect(firstValueFrom(response)).rejects.toMatchObject({
      code: AppErrorCode.COMMENT_UPLOAD_FILE_TOO_LARGE,
    })
  })
})
