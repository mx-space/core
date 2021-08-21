/*
 * @Author: Innei
 * @Date: 2021-02-04 15:17:04
 * @LastEditTime: 2021-02-04 15:18:08
 * @LastEditors: Innei
 * @FilePath: /server/shared/utils/validator-decorators/isMongoIdOrInt.ts
 * @Mark: Coding with Love
 */

import { isInt, isMongoId, ValidationOptions } from 'class-validator'
import { merge } from 'lodash'
import { validatorFactory } from './simpleValidatorFactory'

export function IsBooleanOrString(validationOptions?: ValidationOptions) {
  return validatorFactory((value) => isInt(value) || isMongoId(value))(
    merge<ValidationOptions, ValidationOptions>(validationOptions || {}, {
      message: '类型必须为 MongoId or Int',
    }),
  )
}
