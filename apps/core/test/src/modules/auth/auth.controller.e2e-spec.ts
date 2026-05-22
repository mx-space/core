import { describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { EventBusEvents } from '~/constants/event-bus.constant'
import { AuthController } from '~/modules/auth/auth.controller'

const createController = () => {
  const authService = {
    verifyCustomToken: vi.fn().mockResolvedValue([true, { userId: 'owner-1' }]),
    getTokenSecret: vi.fn().mockResolvedValue({ id: 'token-1' }),
    getAllAccessToken: vi
      .fn()
      .mockResolvedValue([
        { id: 'token-1', token: 'txo-token', name: 'deploy' },
      ]),
    createAccessToken: vi.fn().mockResolvedValue({ token: 'txo-token' }),
    deleteToken: vi.fn(),
    getSessionUser: vi.fn(),
    getOauthUserAccount: vi.fn(),
  }
  const eventEmitter = { emit: vi.fn() }
  const authInstance = {
    get: vi.fn(() => ({
      api: { getProviders: vi.fn().mockResolvedValue([]) },
    })),
  }
  return {
    authService,
    controller: new AuthController(
      authService as any,
      eventEmitter as any,
      authInstance as any,
    ),
    eventEmitter,
  }
}

describe('AuthController', () => {
  it('verifies custom tokens when a token query is present', async () => {
    const { authService, controller } = createController()

    await expect(controller.getOrVerifyToken('txo-token')).resolves.toBe(true)
    expect(authService.verifyCustomToken).toHaveBeenCalledWith('txo-token')
  })

  it('emits token expiration after deleting an existing PG API key', async () => {
    const { authService, controller, eventEmitter } = createController()

    await expect(controller.deleteToken({ id: 'token-1' })).resolves.toBe('OK')

    expect(authService.deleteToken).toHaveBeenCalledWith('token-1')
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventBusEvents.TokenExpired,
      'txo-token',
    )
  })

  it('rejects deletion when the token id is not found', async () => {
    const { authService, controller } = createController()
    authService.getAllAccessToken.mockResolvedValue([])

    await expect(controller.deleteToken({ id: 'missing' })).rejects.toThrow(
      AppException,
    )
  })
})
