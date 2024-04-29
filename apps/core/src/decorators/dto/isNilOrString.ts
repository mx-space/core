import {
  ValidatorConstraint,
  isString,
  registerDecorator,
} from 'class-validator'
import { isNil } from 'lodash'
import type {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ async: true })
class IsNilOrStringConstraint implements ValidatorConstraintInterface {
  validate(value: any, _args: ValidationArguments) {
    return isNil(value) || isString(value)
  }
}

export function IsNilOrString(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNilOrStringConstraint,
    })
  }
}
