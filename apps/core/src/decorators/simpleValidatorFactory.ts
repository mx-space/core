/*
 * @Author: Innei
 * @Date: 2020-08-02 13:00:15
 * @LastEditTime: 2020-08-02 13:13:01
 * @LastEditors: Innei
 * @FilePath: /mx-server/src/common/decorators/simpleValidatorFactory.ts
 * @Coding with Love
 */
import { ValidatorConstraint, registerDecorator } from 'class-validator'
import type {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraintInterface,
} from 'class-validator'

export function validatorFactory(validator: (value: any) => boolean) {
  @ValidatorConstraint({ async: true })
  class IsBooleanOrStringConstraint implements ValidatorConstraintInterface {
    validate(value: any, _args: ValidationArguments) {
      return validator.call(this, value)
    }
  }

  return function (validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
      registerDecorator({
        target: object.constructor,
        propertyName,
        options: validationOptions,
        constraints: [],
        validator: IsBooleanOrStringConstraint,
      })
    }
  }
}
