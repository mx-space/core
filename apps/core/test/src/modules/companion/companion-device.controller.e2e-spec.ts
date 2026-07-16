import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { beforeEach, expect, vi } from 'vitest'

import { CompanionDeviceController } from '~/modules/companion/companion-device.controller'
import { CompanionDeviceService } from '~/modules/companion/companion-device.service'

describe('Companion device routes', () => {
  const service = {
    createPairing: vi.fn(),
    claimPairing: vi.fn(),
    listDevices: vi.fn(),
    revokeDevice: vi.fn(),
  }
  const proxy = createE2EApp({
    controllers: [CompanionDeviceController],
    providers: [{ provide: CompanionDeviceService, useValue: service }],
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires an owner session to create a pairing and defaults to the minimum scope', async () => {
    service.createPairing.mockResolvedValue({
      pairingId: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
      pairingCode: '01234-56789',
      expiresAt: '2026-07-16T12:10:00.000Z',
    })

    const unauthorized = await proxy.app.inject({
      method: 'POST',
      url: '/companion/pairings',
      payload: {},
    })
    expect(unauthorized.statusCode).toBe(401)

    const response = await proxy.app.inject({
      method: 'POST',
      url: '/companion/pairings',
      headers: authPassHeader,
      payload: {},
    })
    expect(response.statusCode).toBe(201)
    expect(service.createPairing).toHaveBeenCalledWith('1', [
      'companion:presence:write',
    ])
    expect(response.json()).toMatchObject({
      data: {
        pairingId: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        pairingCode: '01234-56789',
      },
    })
    expect(response.json().data).not.toHaveProperty('pairing_id')
  })

  it('claims publicly once and returns the plaintext device token in camelCase', async () => {
    service.claimPairing.mockResolvedValue({
      deviceId: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
      deviceToken: 'yhc_one-time-secret',
      scopes: ['companion:presence:write'],
      nextSequence: 0,
    })

    const response = await proxy.app.inject({
      method: 'POST',
      url: '/companion/pairings/claim',
      payload: {
        pairingCode: '01234-56789',
        deviceName: 'MacBook Pro',
      },
    })
    expect(response.statusCode).toBe(201)
    expect(response.json().data).toMatchObject({
      deviceToken: 'yhc_one-time-secret',
      nextSequence: 0,
    })
    expect(response.json().data).not.toHaveProperty('device_token')
  })

  it('rejects unknown claim fields before any credential is minted', async () => {
    const response = await proxy.app.inject({
      method: 'POST',
      url: '/companion/pairings/claim',
      payload: {
        pairingCode: '01234-56789',
        deviceName: 'MacBook Pro',
        deviceToken: 'must-not-be-accepted',
      },
    })

    expect(response.statusCode).toBe(422)
    expect(service.claimPairing).not.toHaveBeenCalled()
  })
})
