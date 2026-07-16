import { describe, expect, it, vi } from 'vitest'

import { CompanionDeviceReconciler } from '~/modules/companion/companion-device.reconciler'
import type { CompanionDeviceRepository } from '~/modules/companion/companion-device.repository'
import type { CompanionPresenceRevocationPort } from '~/modules/companion/companion-presence-revocation.port'

describe('CompanionDeviceReconciler', () => {
  it('acknowledges successful removals and leaves failed removals pending', async () => {
    const now = new Date('2026-07-16T12:00:00.000Z')
    const repository = {
      listDevicesPendingPresenceClear: vi
        .fn()
        .mockResolvedValue([
          { id: 'device-success' },
          { id: 'device-failure' },
        ]),
      markPresenceCleared: vi.fn().mockResolvedValue(null),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn().mockImplementation(async (deviceId: string) => {
        if (deviceId === 'device-failure') {
          throw new Error('Redis unavailable')
        }
      }),
    } satisfies CompanionPresenceRevocationPort
    const reconciler = new CompanionDeviceReconciler(repository, revocationPort)

    await expect(reconciler.reconcile(now)).resolves.toBeUndefined()
    expect(revocationPort.removeDevice).toHaveBeenCalledTimes(2)
    expect(repository.markPresenceCleared).toHaveBeenCalledOnce()
    expect(repository.markPresenceCleared).toHaveBeenCalledWith(
      'device-success',
      now,
    )
  })

  it('retries removal when the prior acknowledgement write failed', async () => {
    const firstAttempt = new Date('2026-07-16T12:00:00.000Z')
    const secondAttempt = new Date('2026-07-16T12:00:05.000Z')
    const repository = {
      listDevicesPendingPresenceClear: vi
        .fn()
        .mockResolvedValue([{ id: 'device-pending' }]),
      markPresenceCleared: vi
        .fn()
        .mockRejectedValueOnce(new Error('Postgres unavailable'))
        .mockResolvedValueOnce(null),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn().mockResolvedValue(undefined),
    } satisfies CompanionPresenceRevocationPort
    const reconciler = new CompanionDeviceReconciler(repository, revocationPort)

    await reconciler.reconcile(firstAttempt)
    await reconciler.reconcile(secondAttempt)

    expect(revocationPort.removeDevice).toHaveBeenCalledTimes(2)
    expect(repository.markPresenceCleared).toHaveBeenNthCalledWith(
      1,
      'device-pending',
      firstAttempt,
    )
    expect(repository.markPresenceCleared).toHaveBeenNthCalledWith(
      2,
      'device-pending',
      secondAttempt,
    )
  })

  it('does not overlap reconciliation passes', async () => {
    let releaseRemoval!: () => void
    const removalPending = new Promise<void>((resolve) => {
      releaseRemoval = resolve
    })
    const repository = {
      listDevicesPendingPresenceClear: vi
        .fn()
        .mockResolvedValue([{ id: 'device-pending' }]),
      markPresenceCleared: vi.fn().mockResolvedValue(null),
    } as unknown as CompanionDeviceRepository
    const revocationPort = {
      removeDevice: vi.fn().mockReturnValue(removalPending),
    } satisfies CompanionPresenceRevocationPort
    const reconciler = new CompanionDeviceReconciler(repository, revocationPort)

    const firstPass = reconciler.reconcile()
    await vi.waitFor(() => {
      expect(revocationPort.removeDevice).toHaveBeenCalledOnce()
    })
    await expect(reconciler.reconcile()).resolves.toBeUndefined()
    expect(repository.listDevicesPendingPresenceClear).toHaveBeenCalledOnce()

    releaseRemoval()
    await firstPass
    expect(repository.markPresenceCleared).toHaveBeenCalledOnce()
  })
})
