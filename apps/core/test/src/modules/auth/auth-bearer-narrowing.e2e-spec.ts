import { Controller, Get, Module, UseGuards } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { vi } from 'vitest'

import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { CurrentUser } from '~/common/decorators/current-user.decorator'
import { AuthGuard } from '~/common/guards/auth.guard'
import { extendedZodValidationPipeInstance } from '~/common/zod'
import { AuthService } from '~/modules/auth/auth.service'
import type { SessionUser } from '~/modules/auth/auth.types'

const ownerUser: SessionUser = {
  id: 'owner-1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'owner',
}

const VALID_API_KEY = 'txo-valid-owner-key'

@Controller('bearer-narrow')
class BearerNarrowingTestController {
  @Get('protected')
  @UseGuards(AuthGuard)
  async protected(@CurrentUser() user: SessionUser) {
    return { id: user.id, role: user.role }
  }
}

const buildAuthService = () => {
  const reader = {
    findById: vi.fn(async (id: string) =>
      id === ownerUser.id
        ? {
            id: ownerUser.id,
            email: ownerUser.email,
            name: ownerUser.name,
            image: null,
            role: 'owner',
            handle: null,
            username: null,
            displayUsername: null,
          }
        : null,
    ),
    findOwner: vi.fn(async () => ({ id: ownerUser.id })),
  }
  const authRepository = { findApiKey: vi.fn().mockResolvedValue(null) }
  const ownerRepository = {}
  const authInstance = {
    get: () => ({
      api: {
        verifyApiKey: vi.fn(async ({ body }: { body: { key: string } }) =>
          body.key === VALID_API_KEY
            ? { valid: true, key: { referenceId: ownerUser.id } }
            : { valid: false },
        ),
      },
    }),
  }
  const service = new AuthService(
    authRepository as any,
    reader as any,
    ownerRepository as any,
    authInstance as any,
    { nextId: () => '740375270589665280' } as any,
  )
  vi.spyOn(service, 'getSessionUser').mockResolvedValue(null)
  vi.spyOn(service, 'isOwnerReaderId').mockImplementation(
    async (id) => id === ownerUser.id,
  )
  return service
}

@Module({
  controllers: [BearerNarrowingTestController],
  providers: [
    {
      provide: AuthService,
      useFactory: buildAuthService,
    },
    AuthGuard,
  ],
})
class BearerNarrowingTestModule {}

describe('apiKey Bearer narrowing (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BearerNarrowingTestModule],
    }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    app.useGlobalPipes(extendedZodValidationPipeInstance)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  test('x-api-key header authenticates the owner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bearer-narrow/protected',
      headers: { 'x-api-key': VALID_API_KEY },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: ownerUser.id, role: 'owner' })
  })

  test('Authorization: Bearer api-key is no longer accepted', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bearer-narrow/protected',
      headers: { authorization: `Bearer ${VALID_API_KEY}` },
    })
    expect(res.statusCode).toBe(401)
  })

  test('missing credentials yields 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/bearer-narrow/protected',
    })
    expect(res.statusCode).toBe(401)
  })
})
