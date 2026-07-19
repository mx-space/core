import { createE2EApp } from 'test/helper/create-e2e-app'
import { beforeEach, vi } from 'vitest'

import { CompanionFailureResponseV2Schema } from '~/modules/companion/companion.schema'
import { CompanionCredentialService } from '~/modules/companion/companion-credential.service'
import { CompanionDeviceGuard } from '~/modules/companion/companion-device.guard'
import { CompanionDeviceRepository } from '~/modules/companion/companion-device.repository'
import { CompanionMomentController } from '~/modules/companion/companion-moment.controller'
import { CompanionMomentService } from '~/modules/companion/companion-moment.service'

const DEVICE_ID = '01K0A4VDWYSH1JQH4PGY4QM8YT'
const REQUEST_ID = '01K0A5Q2R7Y5VXG4H7Q0F4M9J2'

const momentService = {
  publish: vi.fn().mockResolvedValue({
    id: '123456789',
    createdAt: '2026-07-16T12:00:00.100Z',
    url: 'https://example.com/thinking/123456789',
  }),
}
const deviceRepository = {
  findDeviceById: vi.fn().mockResolvedValue({
    id: DEVICE_ID,
    ownerId: 'owner-1',
    scopes: ['companion:moment:write'],
    tokenHash: 'hash',
    revokedAt: null,
  }),
  markLastSeen: vi.fn().mockResolvedValue(undefined),
}
const credentialService = {
  deviceIdFromToken: vi.fn().mockReturnValue(DEVICE_ID),
  verifyDeviceToken: vi.fn().mockReturnValue(true),
}

const request = {
  meta: {
    schema: 'yohaku.companion.moment',
    schemaVersion: 1,
    requestId: REQUEST_ID,
    observedAt: '2026-07-16T12:00:00.000Z',
  },
  data: {
    content: '',
    application: {
      displayName: 'Xcode',
      activity: { key: 'editing', customLabel: null },
      window: null,
      icon: null,
    },
    media: null,
  },
}

describe('Companion Moment endpoint', () => {
  const proxy = createE2EApp({
    controllers: [CompanionMomentController],
    providers: [
      { provide: CompanionMomentService, useValue: momentService },
      CompanionDeviceGuard,
      { provide: CompanionDeviceRepository, useValue: deviceRepository },
      { provide: CompanionCredentialService, useValue: credentialService },
    ],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    deviceRepository.findDeviceById.mockResolvedValue({
      id: DEVICE_ID,
      ownerId: 'owner-1',
      scopes: ['companion:moment:write'],
      tokenHash: 'hash',
      revokedAt: null,
    })
  })

  it('publishes a context-only Recently without accepting device identity in the body', async () => {
    const response = await proxy.app.inject({
      method: 'POST',
      url: '/companion/recently',
      headers: { authorization: 'Bearer device-token' },
      payload: request,
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      meta: { requestId: REQUEST_ID },
      data: { id: '123456789' },
    })
    expect(momentService.publish).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: DEVICE_ID, ownerId: 'owner-1' }),
      expect.objectContaining({
        meta: expect.not.objectContaining({ deviceId: expect.anything() }),
      }),
    )
  })

  it('rejects an older pairing that lacks Moment publishing scope', async () => {
    deviceRepository.findDeviceById.mockResolvedValue({
      id: DEVICE_ID,
      ownerId: 'owner-1',
      scopes: ['companion:presence:write'],
      tokenHash: 'hash',
      revokedAt: null,
    })

    const response = await proxy.app.inject({
      method: 'POST',
      url: '/companion/recently',
      headers: { authorization: 'Bearer device-token' },
      payload: request,
    })

    expect(response.statusCode).toBe(403)
    expect(
      CompanionFailureResponseV2Schema.parse(response.json()),
    ).toMatchObject({ error: { code: 'COMPANION_SCOPE_DENIED' } })
    expect(momentService.publish).not.toHaveBeenCalled()
  })
})
