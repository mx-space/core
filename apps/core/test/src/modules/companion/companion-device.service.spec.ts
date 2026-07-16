import { describe, expect, it, vi } from 'vitest'

import { CompanionCredentialService } from '~/modules/companion/companion-credential.service'
import type { CompanionDeviceRepository } from '~/modules/companion/companion-device.repository'
import { CompanionDeviceService } from '~/modules/companion/companion-device.service'
import type { CompanionPresenceRevocationPort } from '~/modules/companion/companion-presence-revocation.port'

describe('CompanionDeviceService', () => {
  it('removes the device projection only after a persistent owner revocation succeeds', async () => {
    const now = new Date('2026-07-16T12:00:00.000Z')
    const events: string[] = []
    const repository = {
      revokeDevice: vi.fn().mockResolvedValue({
        id: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        revokedAt: now,
        presenceClearedAt: null,
      }),
      markPresenceCleared: vi.fn().mockImplementation(async () => {
        events.push('acknowledged')
        return null
      }),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn().mockImplementation(async () => {
        events.push('removed')
      }),
    } satisfies CompanionPresenceRevocationPort
    const service = new CompanionDeviceService(
      repository,
      new CompanionCredentialService(),
      revocationPort,
    )

    await expect(
      service.revokeDevice(
        'owner-1',
        '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        now,
      ),
    ).resolves.toEqual({
      deviceId: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
      revokedAt: '2026-07-16T12:00:00.000Z',
    })
    expect(revocationPort.removeDevice).toHaveBeenCalledWith(
      '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
    )
    expect(repository.markPresenceCleared).toHaveBeenCalledWith(
      '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
      now,
    )
    expect(events).toEqual(['removed', 'acknowledged'])
  })

  it('does not clear another projection when owner-scoped revocation fails', async () => {
    const repository = {
      revokeDevice: vi.fn().mockResolvedValue(null),
      markPresenceCleared: vi.fn(),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn().mockResolvedValue(undefined),
    } satisfies CompanionPresenceRevocationPort
    const service = new CompanionDeviceService(
      repository,
      new CompanionCredentialService(),
      revocationPort,
    )

    await expect(
      service.revokeDevice('owner-1', '018f3d68-0c82-7df5-8fb1-f07df2e3b16f'),
    ).rejects.toMatchObject({ code: 'COMPANION_DEVICE_NOT_FOUND' })
    expect(revocationPort.removeDevice).not.toHaveBeenCalled()
    expect(repository.markPresenceCleared).not.toHaveBeenCalled()
  })

  it('leaves a revoked device pending when projection removal fails', async () => {
    const now = new Date('2026-07-16T12:00:00.000Z')
    const repository = {
      revokeDevice: vi.fn().mockResolvedValue({
        id: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        revokedAt: now,
        presenceClearedAt: null,
      }),
      markPresenceCleared: vi.fn(),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    } satisfies CompanionPresenceRevocationPort
    const service = new CompanionDeviceService(
      repository,
      new CompanionCredentialService(),
      revocationPort,
    )

    await expect(
      service.revokeDevice(
        'owner-1',
        '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        now,
      ),
    ).rejects.toThrow('Redis unavailable')
    expect(repository.markPresenceCleared).not.toHaveBeenCalled()
  })

  it('does not repeat projection removal after it has been acknowledged', async () => {
    const now = new Date('2026-07-16T12:00:00.000Z')
    const repository = {
      revokeDevice: vi.fn().mockResolvedValue({
        id: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        revokedAt: now,
        presenceClearedAt: now,
      }),
      markPresenceCleared: vi.fn(),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn(),
    } satisfies CompanionPresenceRevocationPort
    const service = new CompanionDeviceService(
      repository,
      new CompanionCredentialService(),
      revocationPort,
    )

    await expect(
      service.revokeDevice(
        'owner-1',
        '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
        now,
      ),
    ).resolves.toEqual({
      deviceId: '018f3d68-0c82-7df5-8fb1-f07df2e3b16f',
      revokedAt: now.toISOString(),
    })
    expect(revocationPort.removeDevice).not.toHaveBeenCalled()
    expect(repository.markPresenceCleared).not.toHaveBeenCalled()
  })
})
