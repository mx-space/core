import type { ArgumentsHost } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { CompanionFailureResponseV2Schema } from '~/modules/companion/companion.schema'
import { CompanionPresenceExceptionFilter } from '~/modules/companion/companion-presence.filter'
import { CompanionDeviceRevokedError } from '~/modules/companion/companion-presence.store'

describe('CompanionPresenceExceptionFilter', () => {
  it('maps an atomic tombstone rejection to the stable revoked-device boundary', () => {
    const reply: Record<string, any> = {}
    reply.status = vi.fn(() => reply)
    reply.type = vi.fn(() => reply)
    reply.send = vi.fn((body) => body)
    const requestId = '01K0A5Q2R7Y5VXG4H7Q0F4M9J2'
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          url: '/companion/presence',
          body: { meta: { requestId } },
        }),
        getResponse: () => reply,
      }),
    } as ArgumentsHost

    new CompanionPresenceExceptionFilter().catch(
      new CompanionDeviceRevokedError(),
      host,
    )

    expect(reply.status).toHaveBeenCalledWith(401)
    expect(
      CompanionFailureResponseV2Schema.parse(reply.send.mock.calls[0][0]),
    ).toMatchObject({
      meta: { requestId },
      error: {
        code: 'COMPANION_DEVICE_REVOKED',
        retryable: false,
        acceptedSequence: null,
      },
    })
  })
})
