import { HttpException } from '@nestjs/common'
import { z } from 'zod'

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

export const ErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  HTTP_ERROR: 'HTTP_ERROR',
} as const

export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status)
  }
}
