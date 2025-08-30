import { isURL } from 'class-validator'
import type { ValidationOptions } from 'class-validator'
import { validatorFactory } from '../simpleValidatorFactory'

export const IsAllowedUrl = (validationOptions?: ValidationOptions) => {
  return validatorFactory((val) =>
    isURL(val, { require_protocol: true, require_tld: false }),
  )({
    message: '请更正为正确的网址',
    ...validationOptions,
  })
}
