import { HttpException } from '@nestjs/common'

import { ErrorCode, ErrorCodeEnum } from '~/constants/error-code.constant'

export class BusinessException extends HttpException {
  constructor(code: ErrorCodeEnum, extraMessage?: string) {
    const [message, status] = ErrorCode[code]
    const jointMessage = message + (extraMessage ? `: ${extraMessage}` : '')
    super(
      HttpException.createBody(
        { code, message: jointMessage },
        jointMessage,
        status,
      ),
      status,
    )
  }
}

export { BusinessException as BizException }
