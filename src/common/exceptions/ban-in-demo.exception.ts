import { ErrorCodeEnum } from '~/constants/error-code.constant'

import { BusinessException } from './business.exception'

export class BanInDemoExcpetion extends BusinessException {
  constructor() {
    super(ErrorCodeEnum.BanInDemo)
  }
}
