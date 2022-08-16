import { HttpException } from '@nestjs/common'

import { ErrorCode, ErrorCodeEnum } from '~/constants/error-code.constant'

export class BusinessException extends HttpException {
  constructor(code: ErrorCodeEnum, extraMessage?: string)
  constructor(message: string)
  constructor(...args: any[]) {
    let status = 500
    const [code, extraMessage] = args as any
    const bizError = ErrorCode[code] || []
    const [message] = bizError
    status = bizError[1] ?? status

    const isOnlyMessage = typeof code == 'string' && args.length === 1

    const jointMessage = isOnlyMessage
      ? code // this code is message
      : message + (extraMessage ? `: ${extraMessage}` : '')
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
