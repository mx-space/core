import { randomUUID } from 'node:crypto'

import type { ResponseMeta } from '~/common/response/meta.types'

import {
  COMPANION_PRESENCE_SCHEMA,
  COMPANION_PRESENCE_SCHEMA_VERSION,
} from './companion.constants'
import {
  CompanionFailureResponseV2Schema,
  CompanionResponseMetaV2Schema,
} from './companion.schema'
import type {
  CompanionFailureResponseV2,
  CompanionResponseMetaV2,
} from './companion.types'

export const createCompanionResponseMeta = (
  requestId: string = randomUUID(),
  now = new Date(),
): CompanionResponseMetaV2 =>
  CompanionResponseMetaV2Schema.parse({
    schema: COMPANION_PRESENCE_SCHEMA,
    schemaVersion: COMPANION_PRESENCE_SCHEMA_VERSION,
    requestId,
    serverTime: now.toISOString(),
  })

// The global response envelope accepts the application's broad meta type.
// Companion intentionally owns a stricter protocol-specific meta contract.
export const asResponseMeta = (meta: CompanionResponseMetaV2) =>
  meta as unknown as ResponseMeta

interface CreateCompanionFailureResponseOptions {
  requestId?: string
  code: string
  message: string
  retryable?: boolean
  retryAfterMs?: number | null
  acceptedSequence?: number | null
  fields?: string[]
}

export const createCompanionFailureResponse = ({
  requestId,
  code,
  message,
  retryable = false,
  retryAfterMs = null,
  acceptedSequence = null,
  fields = [],
}: CreateCompanionFailureResponseOptions): CompanionFailureResponseV2 =>
  CompanionFailureResponseV2Schema.parse({
    meta: createCompanionResponseMeta(requestId),
    error: {
      code,
      message,
      retryable,
      retryAfterMs,
      acceptedSequence,
      fields,
    },
  })
