import { Buffer } from 'node:buffer'

import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common'
import { lt, valid } from 'semver'

import { AppException } from '~/common/errors/exception.types'
import { RedisService } from '~/processors/redis/redis.service'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'
import { getRedisKey } from '~/utils/redis.util'

import {
  COMPANION_CLIENT_VERSION_HEADER,
  COMPANION_MINIMUM_CLIENT_VERSION,
  COMPANION_PRESENCE_PAYLOAD_BYTES,
  COMPANION_PRESENCE_REQUESTS_PER_MINUTE,
  COMPANION_PRESENCE_SCHEMA,
  COMPANION_PRESENCE_SCHEMA_VERSION,
} from './companion.constants'

const RATE_LIMIT_SCRIPT = String.raw`
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {tostring(count), tostring(redis.call('PTTL', KEYS[1]))}
`

export const assertCompanionPresenceTransport = (
  contentType: string | undefined,
  body: unknown,
  contentLength?: string,
  clientVersion?: string,
) => {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    throw new AppException(
      'COMPANION_MEDIA_TYPE_UNSUPPORTED',
      'Companion presence requests require application/json.',
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    )
  }

  const declaredLength = contentLength ? Number(contentLength) : null
  if (
    declaredLength !== null &&
    Number.isFinite(declaredLength) &&
    declaredLength > COMPANION_PRESENCE_PAYLOAD_BYTES
  ) {
    throw new AppException(
      'COMPANION_PAYLOAD_TOO_LARGE',
      'Companion presence payload exceeds the negotiated limit.',
      HttpStatus.PAYLOAD_TOO_LARGE,
    )
  }

  const serializedBody = JSON.stringify(body) ?? ''
  if (
    Buffer.byteLength(serializedBody, 'utf8') > COMPANION_PRESENCE_PAYLOAD_BYTES
  ) {
    throw new AppException(
      'COMPANION_PAYLOAD_TOO_LARGE',
      'Companion presence payload exceeds the negotiated limit.',
      HttpStatus.PAYLOAD_TOO_LARGE,
    )
  }

  const meta =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { meta?: unknown }).meta
      : undefined
  const schemaMeta =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as { schema?: unknown; schemaVersion?: unknown })
      : undefined
  if (
    schemaMeta &&
    (('schema' in schemaMeta &&
      schemaMeta.schema !== COMPANION_PRESENCE_SCHEMA) ||
      ('schemaVersion' in schemaMeta &&
        schemaMeta.schemaVersion !== COMPANION_PRESENCE_SCHEMA_VERSION))
  ) {
    throw new AppException(
      'COMPANION_SCHEMA_UNSUPPORTED',
      'Companion presence schema or version is not supported.',
      426,
    )
  }

  const normalizedClientVersion = clientVersion?.trim()
  if (
    !normalizedClientVersion ||
    !valid(normalizedClientVersion) ||
    lt(normalizedClientVersion, COMPANION_MINIMUM_CLIENT_VERSION)
  ) {
    throw new AppException(
      'COMPANION_SCHEMA_UNSUPPORTED',
      'Companion client version is not supported.',
      426,
    )
  }
}

@Injectable()
export class CompanionPresenceTransportGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = getNestExecutionContextRequest(context)
    assertCompanionPresenceTransport(
      typeof request.headers['content-type'] === 'string'
        ? request.headers['content-type']
        : undefined,
      request.body,
      typeof request.headers['content-length'] === 'string'
        ? request.headers['content-length']
        : undefined,
      typeof request.headers[COMPANION_CLIENT_VERSION_HEADER] === 'string'
        ? request.headers[COMPANION_CLIENT_VERSION_HEADER]
        : undefined,
    )
    return true
  }
}

@Injectable()
export class CompanionPresenceRateLimiter {
  constructor(@Optional() private readonly redisService?: RedisService) {}

  async consume(deviceId: string, now = new Date()) {
    if (!this.redisService) {
      throw new ServiceUnavailableException(
        'Companion presence rate limiting is not available.',
      )
    }

    const minuteStart = Math.floor(now.getTime() / 60_000) * 60_000
    const retryAfterMs = minuteStart + 60_000 - now.getTime()
    const key = getRedisKey(
      'companion:presence:rate',
      deviceId,
      String(minuteStart),
    )
    const [count] = (await this.redisService
      .getClient()
      .eval(RATE_LIMIT_SCRIPT, 1, key, String(retryAfterMs + 1_000))) as [
      string,
      string,
    ]

    if (Number(count) > COMPANION_PRESENCE_REQUESTS_PER_MINUTE) {
      throw new AppException(
        'COMPANION_RATE_LIMITED',
        'Companion presence request rate exceeded.',
        HttpStatus.TOO_MANY_REQUESTS,
        { retryAfterMs: Math.max(0, retryAfterMs) },
      )
    }
  }
}
