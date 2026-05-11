import { describe, expect, it, vi } from 'vitest'

import { BizException } from '~/common/exceptions/biz.exception'
import { AuthService } from '~/modules/auth/auth.service'

const createService = () => {
  const authRepository = {
    createApiKey: vi.fn(),
    deleteApiKey: vi.fn(),
    listApiKeysForUser: vi.fn(),
    findApiKeyById: vi.fn(),
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
    },
  }
  const authInstance = {
    get: vi.fn(() => auth),
  }
  const service = new AuthService(
    authRepository as any,
    readerRepository as any,
    ownerRepository as any,
    authInstance as any,
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
    ).rejects.toThrow(BizException)
  })

  it('extracts API keys from current and deprecated request locations', () => {
    const { service } = createService()

    expect(
      service.getApiKeyFromRequest({ headers: { 'x-api-key': 'current' } }),
    ).toEqual({ key: 'current', deprecated: false })
    expect(
      service.getApiKeyFromRequest({
        headers: { authorization: 'Bearer legacy' },
      }),
    ).toEqual({ key: 'legacy', deprecated: true })
    expect(service.getApiKeyFromRequest({ query: { token: 'query' } })).toEqual(
      {
        key: 'query',
        deprecated: true,
      },
    )
  })
})
