import { describe, expect, it, vi } from 'vitest'

import { AppException } from '~/common/errors/exception.types'
import { AuthService } from '~/modules/auth/auth.service'

const createService = () => {
  const authRepository = {
    createApiKey: vi.fn(),
    deleteApiKey: vi.fn(),
    listApiKeysForUser: vi.fn(),
    findApiKeyById: vi.fn(),
    findApiKey: vi.fn(),
  }
  const readerRepository = {
    findOwner: vi.fn().mockResolvedValue({ id: 'owner-1' }),
    findById: vi.fn(),
    countOwners: vi.fn(),
    existsByUsernameOrEmail: vi.fn(),
    createReader: vi.fn(),
  }
  const ownerRepository = {
    upsertByReaderId: vi.fn(),
  }
  const auth = {
    api: {
      createApiKey: vi.fn().mockResolvedValue({
        key: 'txo-created',
        name: 'deploy',
        expiresAt: null,
      }),
      getSession: vi.fn(),
      listUserAccounts: vi.fn(),
    },
  }
  const authInstance = {
    get: vi.fn(() => auth),
  }
  const snowflakeService = {
    nextId: vi.fn(() => '740375270589665280'),
  }
  const service = new AuthService(
    authRepository as any,
    readerRepository as any,
    ownerRepository as any,
    authInstance as any,
    snowflakeService as any,
  )
  return { authInstance, authRepository, readerRepository, service }
}

describe('AuthService', () => {
  it('creates Better Auth API keys for the owner reader id', async () => {
    const { authInstance, service } = createService()
    const auth = authInstance.get()

    await expect(
      service.createAccessToken({ name: 'deploy' } as any),
    ).resolves.toEqual({
      name: 'deploy',
      token: 'txo-created',
      expired: undefined,
    })

    expect(auth.api.createApiKey).toHaveBeenCalledWith({
      body: { name: 'deploy', userId: 'owner-1' },
    })
  })

  it('rejects access-token creation when no owner reader exists', async () => {
    const { readerRepository, service } = createService()
    readerRepository.findOwner.mockResolvedValue(null)

    await expect(
      service.createAccessToken({ name: 'deploy' } as any),
    ).rejects.toThrow(AppException)
  })

  it('extracts API keys from the x-api-key header only', () => {
    const { service } = createService()

    expect(
      service.getApiKeyFromRequest({ headers: { 'x-api-key': 'current' } }),
    ).toEqual({ key: 'current' })
    expect(
      service.getApiKeyFromRequest({ query: { token: 'query' } } as any),
    ).toBeNull()
  })

  it('ignores Authorization: Bearer api-key fallback after narrowing', () => {
    const { service } = createService()

    expect(
      service.getApiKeyFromRequest({
        headers: { authorization: 'Bearer txo-legacy' },
      }),
    ).toBeNull()
    expect(
      service.getApiKeyFromRequest({
        headers: { Authorization: 'Bearer txo-legacy' },
      }),
    ).toBeNull()
  })

  it('uses Authorization bearer headers for session lookup', async () => {
    const { authInstance, service } = createService()
    const auth = authInstance.get()
    auth.api.getSession.mockResolvedValue({
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        role: 'owner',
      },
      session: { token: 'session-token' },
    })
    auth.api.listUserAccounts.mockResolvedValue([
      {
        id: 'account-1',
        accountId: 'owner-1',
        providerId: 'device',
      },
    ])
    const headers = new Headers()
    headers.set('authorization', 'Bearer device-access-token')

    await expect(service.getSessionUserFromHeaders(headers)).resolves.toEqual(
      expect.objectContaining({
        provider: 'device',
        providerAccountId: 'owner-1',
        user: expect.objectContaining({ id: 'owner-1', role: 'owner' }),
      }),
    )

    const sessionHeaders = auth.api.getSession.mock.calls[0][0].headers
    expect(sessionHeaders.get('authorization')).toBe(
      'Bearer device-access-token',
    )
  })
})
