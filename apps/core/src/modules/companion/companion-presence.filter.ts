import { randomUUID } from 'node:crypto'

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common'

import { AppException, ErrorCodes } from '~/common/errors/exception.types'

import { CompanionIdentifierSchema } from './companion.schema'
import { CompanionProjectionPolicyError } from './companion-presence.projection'
import {
  CompanionDeviceRevokedError,
  CompanionSequenceError,
} from './companion-presence.store'
import { createCompanionFailureResponse } from './companion-response'

const extractRequestId = (body: unknown) => {
  const candidate = (body as { meta?: { requestId?: unknown } } | null)?.meta
    ?.requestId
  const parsed = CompanionIdentifierSchema.safeParse(candidate)
  return parsed.success ? parsed.data : randomUUID()
}

const extractValidationFields = (details: unknown) => {
  if (!details || typeof details !== 'object') return []
  const errors = (details as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return []

  return errors.flatMap((error) => {
    const field = (error as { field?: unknown } | null)?.field
    return typeof field === 'string' && field.length > 0 ? [field] : []
  })
}

@Catch()
export class CompanionPresenceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CompanionPresenceExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest()
    const reply = context.getResponse()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'COMPANION_INTERNAL_ERROR'
    let message = 'Companion presence request failed.'
    let acceptedSequence: number | null = null
    let fields: string[] = []
    let retryAfterMs: number | null = null

    if (exception instanceof CompanionDeviceRevokedError) {
      status = HttpStatus.UNAUTHORIZED
      code = exception.code
      message = exception.message
    } else if (exception instanceof CompanionSequenceError) {
      status = HttpStatus.CONFLICT
      code = exception.code
      message = exception.message
      acceptedSequence = exception.acceptedSequence
    } else if (exception instanceof CompanionProjectionPolicyError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY
      code = exception.code
      message = exception.message
      fields = [...exception.fields]
    } else if (exception instanceof AppException) {
      status = exception.getStatus()
      code =
        exception.code === ErrorCodes.VALIDATION_FAILED
          ? 'COMPANION_PAYLOAD_INVALID'
          : exception.code
      message = exception.message
      fields = extractValidationFields(exception.details)
      const retryAfter = exception.details?.retryAfterMs
      retryAfterMs =
        typeof retryAfter === 'number' && Number.isSafeInteger(retryAfter)
          ? Math.max(0, retryAfter)
          : null
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = 'COMPANION_RATE_LIMITED'
        message = 'Companion request rate exceeded.'
        const retryAfterHeader =
          reply.getHeader?.('Retry-After') ??
          reply.raw?.getHeader?.('Retry-After')
        const retryAfterSeconds = Number(retryAfterHeader)
        retryAfterMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(0, Math.ceil(retryAfterSeconds * 1_000))
          : null
      } else {
        code = 'COMPANION_HTTP_ERROR'
        message = exception.message
      }
    }

    if (status >= 500) {
      this.logger.error(exception)
    } else {
      this.logger.warn(
        `Companion request rejected (${status}, ${code}) at ${request?.url ?? 'unknown path'}`,
      )
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS && retryAfterMs !== null) {
      reply.header(
        'Retry-After',
        String(Math.max(1, Math.ceil(retryAfterMs / 1_000))),
      )
    }

    const response = createCompanionFailureResponse({
      requestId: extractRequestId(request?.body),
      code,
      message,
      retryable: status === 429 || status >= 500,
      retryAfterMs,
      acceptedSequence,
      fields,
    })
    return reply.status(status).type('application/json').send(response)
  }
}
