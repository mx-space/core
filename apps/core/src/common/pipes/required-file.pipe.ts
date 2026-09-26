import { ParseFilePipe } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

export const requiredFilePipe = new ParseFilePipe({
  exceptionFactory: () => createAppException(AppErrorCode.FILE_REQUIRED),
})
