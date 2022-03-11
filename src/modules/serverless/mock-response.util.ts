import { HttpException } from '@nestjs/common'
import { FunctionContextResponse } from './function.types'

export const createMockedContextResponse = (): FunctionContextResponse => {
  return {
    throws(code, message) {
      throw new HttpException(
        HttpException.createBody({ message }, message, code),
        code,
      )
    },
  }
}
