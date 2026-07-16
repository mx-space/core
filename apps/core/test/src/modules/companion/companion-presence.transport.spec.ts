import { redisHelper } from 'test/helper/redis-mock.helper'

import { AppException } from '~/common/errors/exception.types'
import {
  COMPANION_PRESENCE_PAYLOAD_BYTES,
  COMPANION_PRESENCE_REQUESTS_PER_MINUTE,
} from '~/modules/companion/companion.constants'
import {
  assertCompanionPresenceTransport,
  CompanionPresenceRateLimiter,
} from '~/modules/companion/companion-presence.transport'

describe('Companion presence transport boundaries', () => {
  beforeEach(async () => {
    const helper = await redisHelper
    await helper.RedisService.getClient().flushall()
  })

  it('requires JSON and rejects an oversized canonical body', () => {
    expect(() =>
      assertCompanionPresenceTransport('text/plain', {}),
    ).toThrowError(
      expect.objectContaining({ code: 'COMPANION_MEDIA_TYPE_UNSUPPORTED' }),
    )

    expect(() =>
      assertCompanionPresenceTransport('application/json; charset=utf-8', {
        value: 'x'.repeat(COMPANION_PRESENCE_PAYLOAD_BYTES),
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'COMPANION_PAYLOAD_TOO_LARGE' }),
    )
  })

  it('rejects an explicitly unsupported schema before DTO validation', () => {
    expect(() =>
      assertCompanionPresenceTransport('application/json', {
        meta: {
          schema: 'yohaku.companion.presence',
          schemaVersion: 3,
        },
        data: {},
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'COMPANION_SCHEMA_UNSUPPORTED',
      }),
    )
  })

  it('enforces the advertised minimum client version before mutation', () => {
    const body = {
      meta: {
        schema: 'yohaku.companion.presence',
        schemaVersion: 2,
      },
      data: {},
    }

    expect(() =>
      assertCompanionPresenceTransport(
        'application/json',
        body,
        undefined,
        '1.7.2',
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'COMPANION_SCHEMA_UNSUPPORTED' }),
    )
    expect(() =>
      assertCompanionPresenceTransport(
        'application/json',
        body,
        undefined,
        '1.7.3',
      ),
    ).not.toThrow()
  })

  it('uses a device-scoped atomic request budget and returns a retry boundary', async () => {
    const helper = await redisHelper
    const limiter = new CompanionPresenceRateLimiter(helper.RedisService as any)
    const now = new Date('2026-07-16T12:00:10.000Z')

    for (
      let index = 0;
      index < COMPANION_PRESENCE_REQUESTS_PER_MINUTE;
      index += 1
    ) {
      await limiter.consume('device-a', now)
    }

    const rejection = await limiter
      .consume('device-a', now)
      .catch((error) =>
        error instanceof AppException ? error : Promise.reject(error),
      )
    expect(rejection).toMatchObject({
      code: 'COMPANION_RATE_LIMITED',
      details: { retryAfterMs: 50_000 },
    })

    await expect(limiter.consume('device-b', now)).resolves.toBeUndefined()
  })
})
