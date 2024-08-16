import { isString } from 'class-validator'
import { isBoolean, merge } from 'lodash'
import type { ValidationOptions } from 'class-validator'

import { validatorFactory } from '../simpleValidatorFactory'

export function IsBooleanOrString(validationOptions?: ValidationOptions) {
  return validatorFactory((value) => isBoolean(value) || isString(value))(
    merge<ValidationOptions, ValidationOptions>(validationOptions || {}, {
      message: '类型必须为 String or Boolean',
    }),
  )
}
