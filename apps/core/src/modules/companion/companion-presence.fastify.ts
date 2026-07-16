import { HttpStatus } from '@nestjs/common'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

import { createCompanionFailureResponse } from './companion-response'

const INVALID_PAYLOAD_ERROR_CODES = new Set([
  'FST_ERR_CTP_EMPTY_JSON_BODY',
  'FST_ERR_CTP_INVALID_CONTENT_LENGTH',
  'FST_ERR_CTP_INVALID_JSON_BODY',
])

export const companionPresenceFastifyErrorHandler = (
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (INVALID_PAYLOAD_ERROR_CODES.has(error.code)) {
    return reply
      .status(HttpStatus.BAD_REQUEST)
      .type('application/json')
      .send(
        createCompanionFailureResponse({
          code: 'COMPANION_PAYLOAD_INVALID',
          message: 'Companion request body is not valid JSON.',
        }),
      )
  }

  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return reply
      .status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
      .type('application/json')
      .send(
        createCompanionFailureResponse({
          code: 'COMPANION_MEDIA_TYPE_UNSUPPORTED',
          message: 'Companion presence requests require application/json.',
        }),
      )
  }

  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return reply
      .status(HttpStatus.PAYLOAD_TOO_LARGE)
      .type('application/json')
      .send(
        createCompanionFailureResponse({
          code: 'COMPANION_PAYLOAD_TOO_LARGE',
          message: 'Companion presence payload exceeds the negotiated limit.',
        }),
      )
  }

  throw error
}
