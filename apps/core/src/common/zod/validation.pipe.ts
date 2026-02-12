import { HttpStatus, UnprocessableEntityException } from '@nestjs/common'
import { createZodValidationPipe } from 'nestjs-zod'
import type { ZodError } from 'zod'

function formatValidationMessage(error: ZodError): string {
  const firstError = error.issues[0]
  if (!firstError) return 'Validation failed'

  const path = firstError.path.join('.')
  if (path) return `${path}: ${firstError.message}`

  return firstError.message
}

export const ExtendedZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    return new UnprocessableEntityException({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: formatValidationMessage(error),
      errors: error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    })
  },
})

export const extendedZodValidationPipeInstance = new ExtendedZodValidationPipe()
