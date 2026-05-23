import { HttpStatus } from '@nestjs/common'
import { createZodValidationPipe } from 'nestjs-zod'
import type { ZodError } from 'zod'

import { AppException, ErrorCodes } from '~/common/errors/exception.types'

function formatValidationMessage(error: ZodError): string {
  const firstError = error.issues[0]
  if (!firstError) return 'Validation failed'

  const path = firstError.path.join('.')
  if (path) return `${path}: ${firstError.message}`

  return firstError.message
}

export const ExtendedZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    const errors = error.issues.map((err) => ({
      field: err.path.join('.'),
      path: err.path,
      code: err.code,
      message: err.message,
    }))
    return new AppException(
      ErrorCodes.VALIDATION_FAILED,
      formatValidationMessage(error),
      HttpStatus.UNPROCESSABLE_ENTITY,
      { errors, issues: error.issues },
    )
  },
})

export const extendedZodValidationPipeInstance = new ExtendedZodValidationPipe()
