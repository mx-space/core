import { isInt, isMongoId } from 'class-validator'
import type { ValidationOptions } from 'class-validator'
import { merge } from 'lodash'
import { validatorFactory } from '../simpleValidatorFactory'

export function IsBooleanOrString(validationOptions?: ValidationOptions) {
  return validatorFactory((value) => isInt(value) || isMongoId(value))(
    merge<ValidationOptions, ValidationOptions>(validationOptions || {}, {
      message: '类型必须为 MongoId or Int',
    }),
  )
}
