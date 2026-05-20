import { AppException } from '~/common/response/error.types'
import { ErrorCode, ErrorCodeEnum } from '~/constants/error-code.constant'

export class BusinessException extends AppException {
  public bizCode: ErrorCodeEnum

  constructor(code: ErrorCodeEnum, extraMessage?: string, trace?: string)
  constructor(message: string)
  constructor(...args: any[]) {
    const [first, extraMessage, trace] = args as any

    if (typeof first === 'string' && args.length === 1) {
      super('INTERNAL_ERROR', first as string, 500)
      ;(this as any).bizCode = ErrorCodeEnum.Default
      return
    }

    const bizCode = first as ErrorCodeEnum
    const bizError = ErrorCode[bizCode] || []
    const [message] = bizError
    const status = bizError[1] ?? 500
    const jointMessage = message + (extraMessage ? `: ${extraMessage}` : '')
    const stableCode = ErrorCodeEnum[bizCode] ?? String(bizCode)

    super(stableCode, jointMessage, status)

    if (trace) {
      this.stack = trace
    }

    this.bizCode = typeof first === 'number' ? first : ErrorCodeEnum.Default
  }
}

export { BusinessException as BizException }
