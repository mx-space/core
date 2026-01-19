import { HttpStatus, UnprocessableEntityException } from '@nestjs/common'
import { createZodValidationPipe } from 'nestjs-zod'
import type { ZodError } from 'zod'

/**
 * Extended Zod validation pipe that matches the behavior of
 * the original ExtendedValidationPipe (class-validator based)
 *
 * Key features:
 * - Returns 422 status code for validation errors
 * - Stops at first error
 * - Transforms and validates data
 */
export const ExtendedZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    const firstError = error.issues[0]
    const path = firstError?.path.join('.') || ''
    const message = firstError
      ? path
        ? `${path}: ${firstError.message}`
        : firstError.message
      : 'Validation failed'

    return new UnprocessableEntityException({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message,
      errors: error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    })
  },
})

/**
 * Shared instance for global use
 */
export const extendedZodValidationPipeInstance = new ExtendedZodValidationPipe()
