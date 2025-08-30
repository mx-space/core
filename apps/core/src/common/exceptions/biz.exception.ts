import { HttpException } from '@nestjs/common'
import { ErrorCode, ErrorCodeEnum } from '~/constants/error-code.constant'

export class BusinessException extends HttpException {
  public bizCode: ErrorCodeEnum
  constructor(code: ErrorCodeEnum, extraMessage?: string, trace?: string)
  constructor(message: string)
  constructor(...args: any[]) {
    let status = 500
    const [bizCode, extraMessage, trace] = args as any
    const bizError = ErrorCode[bizCode] || []
    const [message] = bizError
    status = bizError[1] ?? status

    const isOnlyMessage = typeof bizCode == 'string' && args.length === 1

    const jointMessage = isOnlyMessage
      ? bizCode // this code is message
      : message + (extraMessage ? `: ${extraMessage}` : '')

    super(
      HttpException.createBody({
        code: bizCode,
        message: jointMessage,
      }),
      status,
    )

    this.stack = trace

    this.bizCode = typeof bizCode === 'number' ? bizCode : ErrorCodeEnum.Default
  }
}

export { BusinessException as BizException }
