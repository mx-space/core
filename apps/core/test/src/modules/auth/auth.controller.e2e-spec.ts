import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { AuthInstanceInjectKey } from '~/modules/auth/auth.constant'
import { AuthController } from '~/modules/auth/auth.controller'
import { AuthService } from '~/modules/auth/auth.service'
import { DatabaseService } from '~/processors/database/database.service'
import { Types } from 'mongoose'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'
import { eventEmitterProvider } from 'test/mock/processors/event.mock'
import { vi } from 'vitest'

const ownerId = new Types.ObjectId()

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
    findOne: vi.fn().mockResolvedValue(docs[0] ?? null),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new Types.ObjectId() }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: vi.fn().mockResolvedValue(docs.length),
  }
}

const readersCol = createMockCollection([
  { _id: ownerId, role: 'owner', email: 'owner@test.com', name: 'Owner' },
])
const accountsCol = createMockCollection([])
const apikeyCol = createMockCollection([])

const mockVerifyApiKey = vi.fn().mockResolvedValue(null)
const mockGetProviders = vi.fn().mockResolvedValue([])

const collections: Record<string, any> = {
  readers: readersCol,
  accounts: accountsCol,
  apikey: apikeyCol,
  passkey: createMockCollection([]),
  owner_profiles: createMockCollection([]),
}

describe('AuthController (e2e)', async () => {
  const proxy = createE2EApp({
    controllers: [AuthController],
    providers: [
      AuthService,
      ...eventEmitterProvider,
      {
        provide: AuthInstanceInjectKey,
        useValue: {
          get: () => ({
            options: { socialProviders: { github: {} } },
            api: {
              getSession: vi.fn().mockResolvedValue(null),
              listUserAccounts: vi.fn().mockResolvedValue([]),
              verifyApiKey: mockVerifyApiKey,
              getProviders: mockGetProviders,
            },
          }),
        },
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
    imports: [],
    models: [],
  })

  describe('POST /auth/token', () => {
    it('should return 401 without auth', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/auth/token`,
        payload: { name: 'test-key' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('should generate token with auth', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/auth/token`,
        payload: { name: 'test-key' },
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(201)
      const json = res.json()
      expect(json.token).toBeDefined()
      expect(json.token).toMatch(/^txo/)
      expect(json.name).toBe('test-key')
    })

    it('should reject without name', async () => {
      const res = await proxy.app.inject({
        method: 'POST',
        url: `${apiRoutePrefix}/auth/token`,
        payload: {},
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(422)
    })
  })

  describe('GET /auth/token', () => {
    it('should return 401 without auth', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/auth/token`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('should list all tokens with auth', async () => {
      apikeyCol.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            key: 'txo-1',
            name: 'key-1',
            createdAt: new Date(),
            expiresAt: null,
          },
        ]),
      })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/auth/token`,
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(200)
      const json = res.json()
      expect(json.data).toBeDefined()
      expect(json.data).toBeInstanceOf(Array)
    })

    it('should verify token by query param', async () => {
      mockVerifyApiKey.mockResolvedValueOnce({
        valid: true,
        key: { userId: 'u1' },
      })
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/auth/token`,
        query: { token: 'txo-test-token' },
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(200)
    })

    it('should get token by id', async () => {
      const tokenId = new Types.ObjectId()
      apikeyCol.findOne.mockResolvedValueOnce({
        _id: tokenId,
        key: 'secret',
        name: 'my-key',
        createdAt: new Date(),
        expiresAt: null,
      })

      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/auth/token`,
        query: { id: tokenId.toString() },
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('DELETE /auth/token', () => {
    it('should return 401 without auth', async () => {
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/auth/token`,
        query: { id: new Types.ObjectId().toString() },
      })
      expect(res.statusCode).toBe(401)
    })

    it('should return 404 when token not found', async () => {
      apikeyCol.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      })
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/auth/token`,
        query: { id: new Types.ObjectId().toString() },
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(404)
    })

    it('should delete existing token', async () => {
      const tokenId = new Types.ObjectId()
      apikeyCol.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            _id: tokenId,
            key: 'txo-to-delete',
            name: 'k',
            createdAt: new Date(),
            expiresAt: null,
          },
        ]),
      })
      const res = await proxy.app.inject({
        method: 'DELETE',
        url: `${apiRoutePrefix}/auth/token`,
        query: { id: tokenId.toString() },
        headers: { ...authPassHeader },
      })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('GET /auth/session', () => {
    it('should return null when no session', async () => {
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/auth/session`,
      })
      expect(res.statusCode).toBe(200)
    })
  })

  describe('GET /auth/providers', () => {
    it('should return provider list', async () => {
      mockGetProviders.mockResolvedValueOnce([{ id: 'github', name: 'GitHub' }])
      const res = await proxy.app.inject({
        method: 'GET',
        url: `${apiRoutePrefix}/auth/providers`,
      })
      expect(res.statusCode).toBe(200)
    })
  })
})
