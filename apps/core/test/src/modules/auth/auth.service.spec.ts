import { Test } from '@nestjs/testing'
import { RequestContext } from '~/common/contexts/request.context'
import { BizException } from '~/common/exceptions/biz.exception'
import { AuthInstanceInjectKey } from '~/modules/auth/auth.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { DatabaseService } from '~/processors/database/database.service'
import { Types } from 'mongoose'
import { vi } from 'vitest'

function createMockCollection(docs: any[] = []) {
  return {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          next: vi.fn().mockResolvedValue(docs[0] ?? null),
        }),
      }),
      toArray: vi.fn().mockResolvedValue(docs),
    }),
    findOne: vi.fn().mockImplementation(async (query: any) => {
      if (query?._id) {
        return (
          docs.find((d) => d._id?.toString() === query._id?.toString()) ?? null
        )
      }
      return docs[0] ?? null
    }),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new Types.ObjectId() }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(docs.length),
  }
}

const ownerId = new Types.ObjectId()
const ownerDoc = {
  _id: ownerId,
  role: 'owner',
  email: 'owner@test.com',
  name: 'Owner',
  image: null,
  handle: 'owner',
  username: 'owner',
  displayUsername: 'Owner',
}

function createCollections(overrides: Record<string, any> = {}) {
  const collections: Record<string, any> = {
    readers: createMockCollection([ownerDoc]),
    accounts: createMockCollection([]),
    apikey: createMockCollection([]),
    passkey: createMockCollection([]),
    owner_profiles: createMockCollection([]),
    ...overrides,
  }
  return collections
}

function createAuthInstance(overrides: any = {}) {
  return {
    get: () => ({
      options: { socialProviders: {} },
      api: {
        getSession: vi.fn().mockResolvedValue(null),
        listUserAccounts: vi.fn().mockResolvedValue([]),
        verifyApiKey: vi.fn().mockResolvedValue(null),
        ...overrides.api,
      },
      ...overrides,
    }),
  }
}

async function createTestService(
  opts: {
    collections?: Record<string, any>
    authInstance?: any
  } = {},
) {
  const collections = opts.collections ?? createCollections()
  const authInstance = opts.authInstance ?? createAuthInstance()

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      {
        provide: AuthInstanceInjectKey,
        useValue: authInstance,
      },
      {
        provide: DatabaseService,
        useValue: {
          db: {
            collection: (name: string) =>
              collections[name] ?? createMockCollection(),
          },
        },
      },
    ],
  }).compile()

  return { service: moduleRef.get(AuthService), collections, authInstance }
}

describe('AuthService', () => {
  describe('generateAccessToken', () => {
    it('should return token starting with txo, length 43', async () => {
      const { service } = await createTestService()
      const token = await service.generateAccessToken()
      expect(token).toMatch(/^txo/)
      expect(token).toHaveLength(43)
    })
  })

  describe('isCustomToken', () => {
    it('should return true for valid custom token', async () => {
      const { service } = await createTestService()
      expect(service.isCustomToken(`txo${'a'.repeat(40)}`)).toBe(true)
    })

    it('should return false for short token', async () => {
      const { service } = await createTestService()
      expect(service.isCustomToken('txo123')).toBe(false)
    })

    it('should return false for wrong prefix', async () => {
      const { service } = await createTestService()
      expect(service.isCustomToken(`abc${'a'.repeat(40)}`)).toBe(false)
    })
  })

  describe('getApiKeyFromRequest', () => {
    let service: AuthService

    beforeAll(async () => {
      ;({ service } = await createTestService())
    })

    it('should extract from x-api-key header', () => {
      expect(
        service.getApiKeyFromRequest({ headers: { 'x-api-key': 'key1' } }),
      ).toEqual({ key: 'key1', deprecated: false })
    })

    it('should extract from X-API-Key header', () => {
      expect(
        service.getApiKeyFromRequest({ headers: { 'X-API-Key': 'key2' } }),
      ).toEqual({ key: 'key2', deprecated: false })
    })

    it('should extract from x-api-key array header', () => {
      expect(
        service.getApiKeyFromRequest({
          headers: { 'x-api-key': ['key3', 'key4'] },
        }),
      ).toEqual({ key: 'key3', deprecated: false })
    })

    it('should extract from Bearer authorization', () => {
      expect(
        service.getApiKeyFromRequest({
          headers: { authorization: 'Bearer mytoken' },
        }),
      ).toEqual({ key: 'mytoken', deprecated: true })
    })

    it('should extract from Authorization array header', () => {
      expect(
        service.getApiKeyFromRequest({
          headers: { Authorization: ['Bearer arr-token'] },
        }),
      ).toEqual({ key: 'arr-token', deprecated: true })
    })

    it('should ignore authorization without Bearer prefix', () => {
      expect(
        service.getApiKeyFromRequest({
          headers: { authorization: 'Basic abc' },
        }),
      ).toBeNull()
    })

    it('should extract from query token', () => {
      expect(
        service.getApiKeyFromRequest({ headers: {}, query: { token: 'qt' } }),
      ).toEqual({ key: 'qt', deprecated: true })
    })

    it('should return null when nothing present', () => {
      expect(service.getApiKeyFromRequest({ headers: {} })).toBeNull()
      expect(service.getApiKeyFromRequest({})).toBeNull()
    })
  })

  describe('getAllAccessToken', () => {
    it('should return empty array when no owner', async () => {
      const collections = createCollections({
        readers: createMockCollection([]),
      })
      const { service } = await createTestService({ collections })
      expect(await service.getAllAccessToken()).toEqual([])
    })

    it('should return mapped tokens when owner exists', async () => {
      const tokenId = new Types.ObjectId()
      const apiKeyCol = createMockCollection([])
      apiKeyCol.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: tokenId,
            key: 'txo-test',
            name: 'test-key',
            createdAt: new Date('2025-01-01'),
            expiresAt: null,
          },
        ]),
      })
      const collections = createCollections({ apikey: apiKeyCol })
      const { service } = await createTestService({ collections })
      const tokens = await service.getAllAccessToken()
      expect(tokens).toHaveLength(1)
      expect(tokens[0]).toEqual({
        id: tokenId.toString(),
        token: 'txo-test',
        name: 'test-key',
        created: new Date('2025-01-01'),
        expired: undefined,
      })
    })
  })

  describe('getTokenSecret', () => {
    it('should return null for invalid ObjectId', async () => {
      const { service } = await createTestService()
      expect(await service.getTokenSecret('invalid')).toBeNull()
    })

    it('should return null when token not found', async () => {
      const apiKeyCol = createMockCollection([])
      apiKeyCol.findOne.mockResolvedValue(null)
      const { service } = await createTestService({
        collections: createCollections({ apikey: apiKeyCol }),
      })
      const id = new Types.ObjectId().toString()
      expect(await service.getTokenSecret(id)).toBeNull()
    })

    it('should return token details when found', async () => {
      const tokenId = new Types.ObjectId()
      const apiKeyCol = createMockCollection([])
      apiKeyCol.findOne.mockResolvedValue({
        _id: tokenId,
        key: 'secret-key',
        name: 'my-key',
        createdAt: new Date('2025-06-01'),
        expiresAt: new Date('2026-06-01'),
      })
      const { service } = await createTestService({
        collections: createCollections({ apikey: apiKeyCol }),
      })
      const result = await service.getTokenSecret(tokenId.toString())
      expect(result).toEqual({
        id: tokenId.toString(),
        token: 'secret-key',
        name: 'my-key',
        created: new Date('2025-06-01'),
        expired: new Date('2026-06-01'),
      })
    })
  })

  describe('saveToken', () => {
    it('should throw when no owner', async () => {
      const collections = createCollections({
        readers: createMockCollection([]),
      })
      const { service } = await createTestService({ collections })
      await expect(
        service.saveToken({
          name: 'k',
          token: 'txo-test',
          expired: undefined,
        } as any),
      ).rejects.toThrow(BizException)
    })

    it('should insert token when owner exists', async () => {
      const collections = createCollections()
      const { service } = await createTestService({ collections })
      const result = await service.saveToken({
        name: 'key',
        token: 'txo-test-token',
        expired: undefined,
      } as any)
      expect(result.name).toBe('key')
      expect(collections.apikey.insertOne).toHaveBeenCalled()
    })

    it('should set prefix for txo tokens', async () => {
      const collections = createCollections()
      const { service } = await createTestService({ collections })
      await service.saveToken({
        name: 'key',
        token: `txo${'x'.repeat(40)}`,
        expired: undefined,
      } as any)
      const insertArg = collections.apikey.insertOne.mock.calls[0][0]
      expect(insertArg.prefix).toBe('txo')
    })

    it('should not set prefix for non-txo tokens', async () => {
      const collections = createCollections()
      const { service } = await createTestService({ collections })
      await service.saveToken({
        name: 'key',
        token: 'other-token',
        expired: undefined,
      } as any)
      const insertArg = collections.apikey.insertOne.mock.calls[0][0]
      expect(insertArg.prefix).toBeUndefined()
    })
  })

  describe('deleteToken', () => {
    it('should skip delete for invalid ObjectId', async () => {
      const collections = createCollections()
      const { service } = await createTestService({ collections })
      await service.deleteToken('invalid-id')
      expect(collections.apikey.deleteOne).not.toHaveBeenCalled()
    })

    it('should delete for valid ObjectId', async () => {
      const collections = createCollections()
      const { service } = await createTestService({ collections })
      const id = new Types.ObjectId().toString()
      await service.deleteToken(id)
      expect(collections.apikey.deleteOne).toHaveBeenCalled()
    })
  })

  describe('verifyApiKey', () => {
    it('should return null when verification fails', async () => {
      const authInstance = createAuthInstance({
        api: { verifyApiKey: vi.fn().mockResolvedValue(null) },
      })
      const { service } = await createTestService({ authInstance })
      expect(await service.verifyApiKey('bad-key')).toBeNull()
    })

    it('should return null when result is not valid', async () => {
      const authInstance = createAuthInstance({
        api: {
          verifyApiKey: vi.fn().mockResolvedValue({ valid: false, key: null }),
        },
      })
      const { service } = await createTestService({ authInstance })
      expect(await service.verifyApiKey('bad-key')).toBeNull()
    })

    it('should return key when valid', async () => {
      const keyObj = { userId: 'u1', name: 'k' }
      const authInstance = createAuthInstance({
        api: {
          verifyApiKey: vi.fn().mockResolvedValue({ valid: true, key: keyObj }),
        },
      })
      const { service } = await createTestService({ authInstance })
      expect(await service.verifyApiKey('good-key')).toBe(keyObj)
    })

    it('should throw when auth instance is null', async () => {
      const authInstance = { get: () => null }
      const { service } = await createTestService({ authInstance })
      await expect(service.verifyApiKey('key')).rejects.toThrow()
    })
  })

  describe('verifyCustomToken', () => {
    it('should return [false, null] when api key invalid', async () => {
      const authInstance = createAuthInstance({
        api: { verifyApiKey: vi.fn().mockResolvedValue(null) },
      })
      const { service } = await createTestService({ authInstance })
      expect(await service.verifyCustomToken('token')).toEqual([false, null])
    })

    it('should return [true, { userId }] when api key valid', async () => {
      const authInstance = createAuthInstance({
        api: {
          verifyApiKey: vi
            .fn()
            .mockResolvedValue({ valid: true, key: { userId: 'uid1' } }),
        },
      })
      const { service } = await createTestService({ authInstance })
      expect(await service.verifyCustomToken('token')).toEqual([
        true,
        { userId: 'uid1' },
      ])
    })
  })

  describe('createOwnerByCredential', () => {
    it('should throw when username is empty', async () => {
      const { service } = await createTestService()
      await expect(
        service.createOwnerByCredential({
          username: '   ',
          password: 'pass',
          mail: 'a@b.com',
        }),
      ).rejects.toThrow(BizException)
    })

    it('should throw when password is empty', async () => {
      const { service } = await createTestService()
      await expect(
        service.createOwnerByCredential({
          username: 'user',
          password: '',
          mail: 'a@b.com',
        }),
      ).rejects.toThrow(BizException)
    })

    it('should throw when mail is empty', async () => {
      const { service } = await createTestService()
      await expect(
        service.createOwnerByCredential({
          username: 'user',
          password: 'pass',
          mail: '  ',
        }),
      ).rejects.toThrow(BizException)
    })

    it('should throw when owner already exists', async () => {
      const readersCol = createMockCollection([ownerDoc])
      readersCol.countDocuments.mockResolvedValue(1)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      await expect(
        service.createOwnerByCredential({
          username: 'new',
          password: 'pass',
          mail: 'new@b.com',
        }),
      ).rejects.toThrow(BizException)
    })

    it('should throw when username/email already taken', async () => {
      const readersCol = createMockCollection([])
      readersCol.countDocuments.mockResolvedValue(0)
      readersCol.findOne.mockResolvedValue({ _id: new Types.ObjectId() })
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      await expect(
        service.createOwnerByCredential({
          username: 'taken',
          password: 'pass',
          mail: 'taken@b.com',
        }),
      ).rejects.toThrow(BizException)
    })

    it('should create owner successfully', async () => {
      const readersCol = createMockCollection([])
      readersCol.countDocuments.mockResolvedValue(0)
      readersCol.findOne.mockResolvedValue(null)
      const accountsCol = createMockCollection([])
      const profilesCol = createMockCollection([])
      const { service } = await createTestService({
        collections: createCollections({
          readers: readersCol,
          accounts: accountsCol,
          owner_profiles: profilesCol,
        }),
      })
      const result = await service.createOwnerByCredential({
        username: 'newowner',
        password: 'securepass',
        mail: 'new@test.com',
        name: 'New Owner',
        url: 'https://example.com',
        introduce: 'Hello',
        socialIds: { github: 'newowner' },
      })
      expect(result).toBe('OK')
      expect(readersCol.insertOne).toHaveBeenCalled()
      expect(accountsCol.insertOne).toHaveBeenCalled()
      expect(profilesCol.updateOne).toHaveBeenCalled()

      const profileArg = profilesCol.updateOne.mock.calls[0][1].$set
      expect(profileArg.url).toBe('https://example.com')
      expect(profileArg.introduce).toBe('Hello')
      expect(profileArg.socialIds).toEqual({ github: 'newowner' })
    })

    it('should create owner with minimal fields', async () => {
      const readersCol = createMockCollection([])
      readersCol.countDocuments.mockResolvedValue(0)
      readersCol.findOne.mockResolvedValue(null)
      const accountsCol = createMockCollection([])
      const profilesCol = createMockCollection([])
      const { service } = await createTestService({
        collections: createCollections({
          readers: readersCol,
          accounts: accountsCol,
          owner_profiles: profilesCol,
        }),
      })
      const result = await service.createOwnerByCredential({
        username: 'min',
        password: 'pass',
        mail: 'min@t.com',
      })
      expect(result).toBe('OK')
    })

    it('should rollback and throw on duplicate key error after insert', async () => {
      const readersCol = createMockCollection([])
      readersCol.countDocuments.mockResolvedValue(0)
      readersCol.findOne.mockResolvedValue(null)
      readersCol.insertOne.mockResolvedValue({})
      const accountsCol = createMockCollection([])
      accountsCol.insertOne.mockRejectedValue({ code: 11000 })
      const { service } = await createTestService({
        collections: createCollections({
          readers: readersCol,
          accounts: accountsCol,
        }),
      })
      await expect(
        service.createOwnerByCredential({
          username: 'dup',
          password: 'pass',
          mail: 'dup@t.com',
        }),
      ).rejects.toThrow(BizException)
      expect(readersCol.deleteOne).toHaveBeenCalled()
      expect(accountsCol.deleteMany).toHaveBeenCalled()
    })

    it('should rethrow non-duplicate errors after insert', async () => {
      const readersCol = createMockCollection([])
      readersCol.countDocuments.mockResolvedValue(0)
      readersCol.findOne.mockResolvedValue(null)
      readersCol.insertOne.mockResolvedValue({})
      const accountsCol = createMockCollection([])
      const genericError = new Error('connection lost')
      accountsCol.insertOne.mockRejectedValue(genericError)
      const { service } = await createTestService({
        collections: createCollections({
          readers: readersCol,
          accounts: accountsCol,
        }),
      })
      await expect(
        service.createOwnerByCredential({
          username: 'err',
          password: 'pass',
          mail: 'err@t.com',
        }),
      ).rejects.toThrow('connection lost')
    })
  })

  describe('transferOwnerRole', () => {
    it('should throw when target not found', async () => {
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue(null)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      await expect(
        service.transferOwnerRole(new Types.ObjectId().toString()),
      ).rejects.toThrow(BizException)
    })

    it('should transfer role successfully', async () => {
      const targetId = new Types.ObjectId()
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ _id: targetId })
      readersCol.countDocuments.mockResolvedValue(1)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      const result = await service.transferOwnerRole(targetId.toString())
      expect(result).toBe('OK')
      expect(readersCol.updateMany).toHaveBeenCalled()
      expect(readersCol.updateOne).toHaveBeenCalled()
    })

    it('should throw on consistency check failure', async () => {
      const targetId = new Types.ObjectId()
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ _id: targetId })
      readersCol.countDocuments.mockResolvedValue(2)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      await expect(
        service.transferOwnerRole(targetId.toString()),
      ).rejects.toThrow(BizException)
    })
  })

  describe('revokeOwnerRole', () => {
    it('should throw when target not found', async () => {
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue(null)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      await expect(
        service.revokeOwnerRole(new Types.ObjectId().toString()),
      ).rejects.toThrow(BizException)
    })

    it('should return OK when target is not owner', async () => {
      const targetId = new Types.ObjectId()
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ _id: targetId, role: 'reader' })
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      expect(await service.revokeOwnerRole(targetId.toString())).toBe('OK')
    })

    it('should throw when only one owner left', async () => {
      const targetId = new Types.ObjectId()
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ _id: targetId, role: 'owner' })
      readersCol.countDocuments.mockResolvedValue(1)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      await expect(
        service.revokeOwnerRole(targetId.toString()),
      ).rejects.toThrow(BizException)
    })

    it('should revoke when multiple owners exist', async () => {
      const targetId = new Types.ObjectId()
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ _id: targetId, role: 'owner' })
      readersCol.countDocuments.mockResolvedValue(2)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      expect(await service.revokeOwnerRole(targetId.toString())).toBe('OK')
      expect(readersCol.updateOne).toHaveBeenCalled()
    })
  })

  describe('getOauthProviders', () => {
    it('should return empty array when no social providers', async () => {
      const { service } = await createTestService()
      expect(service.getOauthProviders()).toEqual([])
    })

    it('should return provider names', async () => {
      const authInstance = createAuthInstance()
      const originalGet = authInstance.get
      authInstance.get = () => ({
        ...originalGet(),
        options: { socialProviders: { github: {}, google: {} } },
      })
      const { service } = await createTestService({ authInstance })
      expect(service.getOauthProviders()).toEqual(['github', 'google'])
    })
  })

  describe('hasCredentialAccount', () => {
    it('should return false when no owner', async () => {
      const collections = createCollections({
        readers: createMockCollection([]),
      })
      const { service } = await createTestService({ collections })
      expect(await service.hasCredentialAccount()).toBe(false)
    })

    it('should return true when credential account exists', async () => {
      const accountsCol = createMockCollection([])
      accountsCol.countDocuments.mockResolvedValue(1)
      const { service } = await createTestService({
        collections: createCollections({ accounts: accountsCol }),
      })
      expect(await service.hasCredentialAccount()).toBe(true)
    })

    it('should return false when no credential account', async () => {
      const accountsCol = createMockCollection([])
      accountsCol.countDocuments.mockResolvedValue(0)
      const { service } = await createTestService({
        collections: createCollections({ accounts: accountsCol }),
      })
      expect(await service.hasCredentialAccount()).toBe(false)
    })
  })

  describe('hasPasskey', () => {
    it('should return false when no owner', async () => {
      const collections = createCollections({
        readers: createMockCollection([]),
      })
      const { service } = await createTestService({ collections })
      expect(await service.hasPasskey()).toBe(false)
    })

    it('should return true when passkey exists', async () => {
      const passkeyCol = createMockCollection([])
      passkeyCol.countDocuments.mockResolvedValue(1)
      const { service } = await createTestService({
        collections: createCollections({ passkey: passkeyCol }),
      })
      expect(await service.hasPasskey()).toBe(true)
    })
  })

  describe('isOwnerReaderId', () => {
    it('should return false for invalid ObjectId string', async () => {
      const { service } = await createTestService()
      expect(await service.isOwnerReaderId('not-valid')).toBe(false)
    })

    it('should return false when reader not found as owner', async () => {
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue(null)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      expect(
        await service.isOwnerReaderId(new Types.ObjectId().toString()),
      ).toBe(false)
    })

    it('should return true when reader is owner', async () => {
      const { service } = await createTestService()
      expect(await service.isOwnerReaderId(ownerId.toString())).toBe(true)
    })

    it('should accept Types.ObjectId input', async () => {
      const { service } = await createTestService()
      expect(await service.isOwnerReaderId(ownerId)).toBe(true)
    })
  })

  describe('getReaderById', () => {
    it('should return null for empty userId', async () => {
      const { service } = await createTestService()
      expect(await service.getReaderById('')).toBeNull()
    })

    it('should return null when reader not found', async () => {
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue(null)
      const { service } = await createTestService({
        collections: createCollections({ readers: readersCol }),
      })
      expect(
        await service.getReaderById(new Types.ObjectId().toString()),
      ).toBeNull()
    })

    it('should return session user shape when found', async () => {
      const { service } = await createTestService()
      const result = await service.getReaderById(ownerId.toString())
      expect(result).toEqual({
        id: ownerId.toString(),
        email: 'owner@test.com',
        name: 'Owner',
        image: null,
        role: 'owner',
        handle: 'owner',
        username: 'owner',
        displayUsername: 'Owner',
      })
    })
  })

  describe('getOauthUserAccount', () => {
    it('should merge user data into account', async () => {
      const userId = new Types.ObjectId()
      const accountsCol = createMockCollection([])
      accountsCol.findOne.mockResolvedValue({
        providerAccountId: 'gh-123',
        providerId: 'github',
        userId,
      })
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({
        _id: userId,
        email: 'u@t.com',
        name: 'User',
        image: 'img',
        role: 'owner',
        handle: 'user',
      })
      const { service } = await createTestService({
        collections: createCollections({
          accounts: accountsCol,
          readers: readersCol,
        }),
      })
      const result = (await service.getOauthUserAccount('gh-123')) as any
      expect(result.id).toBe(userId.toString())
      expect(result.email).toBe('u@t.com')
      expect(result.provider).toBe('github')
    })

    it('should set provider from providerId when provider missing', async () => {
      const userId = new Types.ObjectId()
      const accountsCol = createMockCollection([])
      accountsCol.findOne.mockResolvedValue({
        providerAccountId: 'gh-456',
        providerId: 'github',
        provider: undefined,
        userId,
      })
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue(null)
      const { service } = await createTestService({
        collections: createCollections({
          accounts: accountsCol,
          readers: readersCol,
        }),
      })
      const result = (await service.getOauthUserAccount('gh-456')) as any
      expect(result.provider).toBe('github')
    })
  })

  describe('getSessionUserFromHeaders', () => {
    it('should return null when no cookie', async () => {
      const { service } = await createTestService()
      const headers = new Headers()
      expect(await service.getSessionUserFromHeaders(headers)).toBeNull()
    })

    it('should throw when auth instance is null', async () => {
      const authInstance = { get: () => null }
      const { service } = await createTestService({ authInstance })
      const headers = new Headers()
      headers.set('cookie', 'session=abc')
      await expect(service.getSessionUserFromHeaders(headers)).rejects.toThrow()
    })

    it('should return null when no session', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      })
      const { service } = await createTestService({ authInstance })
      const headers = new Headers()
      headers.set('cookie', 'session=abc')
      expect(await service.getSessionUserFromHeaders(headers)).toBeNull()
    })

    it('should return null when no accounts', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi
            .fn()
            .mockResolvedValue({ user: { id: '1' }, session: {} }),
          listUserAccounts: vi.fn().mockResolvedValue([]),
        },
      })
      const { service } = await createTestService({ authInstance })
      const headers = new Headers()
      headers.set('cookie', 'session=abc')
      expect(await service.getSessionUserFromHeaders(headers)).toBeNull()
    })

    it('should return session with provider info', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: { id: ownerId.toString(), role: 'owner' },
            session: { provider: 'github' },
          }),
          listUserAccounts: vi.fn().mockResolvedValue([
            {
              providerId: 'github',
              accountId: 'gh-acc',
              id: 'acc-id',
            },
          ]),
        },
      })
      const { service } = await createTestService({ authInstance })
      const headers = new Headers()
      headers.set('cookie', 'session=abc')
      const result = await service.getSessionUserFromHeaders(headers)
      expect(result).toBeDefined()
      expect(result!.providerAccountId).toBe('gh-acc')
      expect(result!.provider).toBe('github')
    })

    it('should lookup role when user has no role', async () => {
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ role: 'owner' })
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: { id: ownerId.toString() },
            session: {},
          }),
          listUserAccounts: vi
            .fn()
            .mockResolvedValue([
              { providerId: 'credential', accountId: 'acc1', id: 'id1' },
            ]),
        },
      })
      const { service } = await createTestService({
        authInstance,
        collections: createCollections({ readers: readersCol }),
      })
      const headers = new Headers()
      headers.set('cookie', 'session=abc')
      const result = await service.getSessionUserFromHeaders(headers)
      expect(result!.user.role).toBe('owner')
    })

    it('should use first account when no session provider match', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: { id: '1', role: 'reader' },
            session: {},
          }),
          listUserAccounts: vi.fn().mockResolvedValue([
            { providerId: 'google', accountId: 'g-acc', id: 'gid' },
            { providerId: 'github', accountId: 'gh-acc', id: 'ghid' },
          ]),
        },
      })
      const { service } = await createTestService({ authInstance })
      const headers = new Headers()
      headers.set('cookie', 'session=abc')
      const result = await service.getSessionUserFromHeaders(headers)
      expect(result!.providerAccountId).toBe('g-acc')
    })
  })

  describe('getSessionUser', () => {
    it('should build headers from IncomingMessage and delegate', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      })
      const { service } = await createTestService({ authInstance })
      const mockReq = {
        headers: {
          cookie: 'session=test',
          origin: 'http://localhost',
        },
      } as any
      const result = await service.getSessionUser(mockReq)
      expect(result).toBeNull()
    })

    it('should handle array cookie and origin headers', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      })
      const { service } = await createTestService({ authInstance })
      const mockReq = {
        headers: {
          cookie: ['session=test', 'other=val'],
          origin: ['http://localhost'],
        },
      } as any
      const result = await service.getSessionUser(mockReq)
      expect(result).toBeNull()
    })
  })

  describe('setCurrentOauthAsOwner', () => {
    it('should throw when no request context', async () => {
      const { service } = await createTestService()
      await expect(service.setCurrentOauthAsOwner()).rejects.toThrow(
        BizException,
      )
    })

    it('should throw when no session', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue(null),
        },
      })
      const { service } = await createTestService({ authInstance })

      const mockReq = {
        headers: { cookie: 'session=test' },
      } as any
      const mockRes = {} as any
      const ctx = new RequestContext(mockReq, mockRes)

      await expect(
        RequestContext.run(ctx, () => service.setCurrentOauthAsOwner()),
      ).rejects.toThrow(BizException)
    })

    it('should throw when session has no user id', async () => {
      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: { role: 'owner' },
            session: {},
          }),
          listUserAccounts: vi
            .fn()
            .mockResolvedValue([
              { providerId: 'github', accountId: 'acc1', id: 'id1' },
            ]),
        },
      })
      const { service } = await createTestService({ authInstance })

      const mockReq = {
        headers: { cookie: 'session=test' },
      } as any
      const mockRes = {} as any
      const ctx = new RequestContext(mockReq, mockRes)

      await expect(
        RequestContext.run(ctx, () => service.setCurrentOauthAsOwner()),
      ).rejects.toThrow(BizException)
    })

    it('should transfer owner role when session is valid', async () => {
      const targetId = new Types.ObjectId()
      const readersCol = createMockCollection([])
      readersCol.findOne.mockResolvedValue({ _id: targetId })
      readersCol.countDocuments.mockResolvedValue(1)

      const authInstance = createAuthInstance({
        api: {
          getSession: vi.fn().mockResolvedValue({
            user: { id: targetId.toString(), role: 'reader' },
            session: {},
          }),
          listUserAccounts: vi
            .fn()
            .mockResolvedValue([
              { providerId: 'credential', accountId: 'acc1', id: 'id1' },
            ]),
        },
      })
      const { service } = await createTestService({
        authInstance,
        collections: createCollections({ readers: readersCol }),
      })

      const mockReq = {
        headers: { cookie: 'session=test' },
      } as any
      const mockRes = {} as any
      const ctx = new RequestContext(mockReq, mockRes)

      const result = await RequestContext.run(ctx, () =>
        service.setCurrentOauthAsOwner(),
      )
      expect(result).toBe('OK')
    })
  })
})
