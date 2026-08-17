import type { ExecutionContext } from '@nestjs/common'
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { describe, expect, it, vi } from 'vitest'

import { PushController } from '~/modules/push/push.controller'
import type { PushService } from '~/modules/push/push.service'

const activationBody = {
  relayUrl: 'https://push.example.com',
  activationTicket: 't'.repeat(32),
}

const contextWith = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext

const customParamFactories = (methodName: string) => {
  const metadata: Record<
    string,
    { factory?: (data: unknown, ctx: ExecutionContext) => unknown }
  > = Reflect.getMetadata(ROUTE_ARGS_METADATA, PushController, methodName) ?? {}
  return Object.values(metadata).filter(
    (entry) => typeof entry.factory === 'function',
  )
}

describe('PushController', () => {
  const createController = () => {
    const service = {
      activate: vi.fn(async () => ({
        enabled: true as const,
        relayUrl: 'https://push.example.com',
        bindingId: 'bnd_remote',
      })),
    }
    return {
      service,
      controller: new PushController(service as unknown as PushService),
    }
  }

  it('keeps activation public instead of guarding the controller', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PushController)).toBeUndefined()
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PushController.prototype.activate),
    ).toBeUndefined()
  })

  it('resolves the reader id from the request without demanding a session', () => {
    const factories = customParamFactories('activate')
    expect(factories).toHaveLength(1)

    const factory = factories[0]!.factory!
    expect(factory(undefined, contextWith({ readerId: 'reader-1' }))).toBe(
      'reader-1',
    )
    expect(factory(undefined, contextWith({}))).toBeUndefined()
  })

  it('associates the activation with the signed-in reader', async () => {
    const { controller, service } = createController()

    await expect(
      controller.activate(activationBody, 'reader-1'),
    ).resolves.toEqual({
      enabled: true,
      relayUrl: 'https://push.example.com',
      bindingId: 'bnd_remote',
    })
    expect(service.activate).toHaveBeenCalledWith('reader-1', activationBody)
  })

  it('activates anonymously when no reader session is present', async () => {
    const { controller, service } = createController()

    await controller.activate(activationBody)

    expect(service.activate).toHaveBeenCalledWith(undefined, activationBody)
  })

  it('no longer exposes the reader-scoped endpoints Relay owns', () => {
    const handlers = PushController.prototype as unknown as Record<
      string,
      unknown
    >
    for (const removed of [
      'status',
      'getPreferences',
      'updatePreferences',
      'deactivate',
    ]) {
      expect(handlers[removed]).toBeUndefined()
    }
  })
})
