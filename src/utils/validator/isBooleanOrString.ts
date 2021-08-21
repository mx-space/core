/*
 * @Author: Innei
 * @Date: 2020-08-02 12:53:38
 * @LastEditTime: 2020-08-02 13:17:33
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/common/decorators/isBooleanOrString.ts
 * @Coding with Love
 */
import { isString, ValidationOptions } from 'class-validator'
import { isBoolean, merge } from 'lodash'
import { validatorFactory } from './simpleValidatorFactory'

export function IsBooleanOrString(validationOptions?: ValidationOptions) {
  return validatorFactory((value) => isBoolean(value) || isString(value))(
    merge<ValidationOptions, ValidationOptions>(validationOptions || {}, {
      message: '类型必须为 String or Boolean',
    }),
  )
}
