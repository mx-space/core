import { vi } from 'vitest'

import { PushController } from '~/modules/push/push.controller'
import type { PushService } from '~/modules/push/push.service'

describe('PushController', () => {
  it('activates anonymously when no reader session is present', async () => {
    const service = {
      activate: vi.fn(async () => ({
        enabled: true,
        relayUrl: 'https://push.example.com',
        bindingId: 'bnd_remote',
      })),
    }
    const controller = new PushController(service as unknown as PushService)

    await expect(
      controller.activate(undefined, {
        relayUrl: 'https://push.example.com',
        activationTicket: 't'.repeat(32),
      }),
    ).resolves.toEqual({
      enabled: true,
      relayUrl: 'https://push.example.com',
      bindingId: 'bnd_remote',
    })
    expect(service.activate).toHaveBeenCalledWith(undefined, {
      relayUrl: 'https://push.example.com',
      activationTicket: 't'.repeat(32),
    })
  })

  it('passes the current reader id when a session is present', async () => {
    const service = {
      activate: vi.fn(async () => ({
        enabled: true,
        relayUrl: 'https://push.example.com',
        bindingId: 'bnd_remote',
      })),
    }
    const controller = new PushController(service as unknown as PushService)

    await controller.activate('reader-1', {
      relayUrl: 'https://push.example.com',
      activationTicket: 't'.repeat(32),
    })

    expect(service.activate).toHaveBeenCalledWith('reader-1', {
      relayUrl: 'https://push.example.com',
      activationTicket: 't'.repeat(32),
    })
  })
})
