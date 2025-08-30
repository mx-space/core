import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { BizException } from './biz.exception'

export class NoContentCanBeModifiedException extends BizException {
  constructor() {
    super(ErrorCodeEnum.NoContentCanBeModified)
  }
}
