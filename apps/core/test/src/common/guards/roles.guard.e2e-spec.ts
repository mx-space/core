import {
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  NestModule,
  UseGuards,
} from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { vi } from 'vitest'

import { RequestContext } from '~/common/contexts/request.context'
import {
  HasAdminAccess,
  HasReaderIdentity,
  IsGuest,
} from '~/common/decorators/role.decorator'
import { RolesGuard } from '~/common/guards/roles.guard'
import { RequestContextMiddleware } from '~/common/middlewares/request-context.middleware'
import type { SessionUser } from '~/modules/auth/auth.types'
import { AuthService } from '~/modules/auth/auth.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { setupE2EApp } from 'test/helper/setup-e2e'

const ownerUser: SessionUser = {
  id: 'owner-1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'owner',
}

const readerUser: SessionUser = {
  id: 'reader-1',
  email: 'reader@example.com',
  name: 'Reader',
  role: 'reader',
}

const normalizeHeader = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value

const mockAuthService = {
  getSessionUser: vi.fn(async (req: { headers: Record<string, unknown> }) => {
    const scenario = normalizeHeader(req.headers['x-test-auth-scenario'] as any)

    if (scenario === 'owner-session') {
      return {
        user: ownerUser,
        session: { token: 'owner-session-token', provider: 'github' },
        provider: 'github',
      }
    }

    if (scenario === 'reader-session') {
      return {
        user: readerUser,
        session: { token: 'reader-session-token', provider: 'github' },
        provider: 'github',
      }
    }

    return null
  }),
  getApiKeyFromRequest: vi.fn(
    ({ headers }: { headers: Record<string, unknown> }) => {
      const key = normalizeHeader(headers['x-test-api-key'] as any)
      return key ? { key, deprecated: false } : null
    },
  ),
  isCustomToken: vi.fn((key: string) => key.startsWith('txo-')),
  verifyApiKey: vi.fn(async (key: string) => {
    if (key === 'txo-owner') {
      return { referenceId: ownerUser.id }
    }

    return null
  }),
  isOwnerReaderId: vi.fn(async (readerId: string) => readerId === ownerUser.id),
  getReaderById: vi.fn(async (readerId: string) =>
    readerId === ownerUser.id ? ownerUser : null,
  ),
}

@Controller('roles-guard')
class RolesGuardE2ETestController {
  @Get('probe')
  @UseGuards(RolesGuard)
  async probe(
    @HasAdminAccess() hasAdminAccess: boolean,
    @HasReaderIdentity() hasReaderIdentity: boolean,
    @IsGuest() isGuest: boolean,
  ) {
    return {
      decorator: {
        hasAdminAccess,
        hasReaderIdentity,
        isGuest,
      },
      context: {
        hasAdminAccess: RequestContext.hasAdminAccess(),
        hasReaderIdentity: RequestContext.hasReaderIdentity(),
        isGuest: RequestContext.currentIsGuest(),
        readerId: RequestContext.currentReaderId(),
        authProvider: RequestContext.currentAuthProvider(),
        userRole: RequestContext.currentUser()?.role ?? null,
      },
    }
  }
}

@Module({
  controllers: [RolesGuardE2ETestController],
  providers: [
    RolesGuard,
    {
      provide: AuthService,
      useValue: mockAuthService,
    },
    {
      provide: ConfigsService,
      useValue: {},
    },
  ],
})
class RolesGuardE2ETestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes(RolesGuardE2ETestController)
  }
}

describe('RolesGuard (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await setupE2EApp({
      imports: [RolesGuardE2ETestModule],
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  test('treats owner session as both admin-authorized and reader-identified', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles-guard/probe',
      headers: {
        'x-test-auth-scenario': 'owner-session',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      decorator: {
        hasAdminAccess: true,
        hasReaderIdentity: true,
        isGuest: false,
      },
      context: {
        hasAdminAccess: true,
        hasReaderIdentity: true,
        isGuest: false,
        readerId: ownerUser.id,
        authProvider: 'github',
        userRole: 'owner',
      },
    })
  })

  test('treats reader session as reader-identified but not admin-authorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles-guard/probe',
      headers: {
        'x-test-auth-scenario': 'reader-session',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      decorator: {
        hasAdminAccess: false,
        hasReaderIdentity: true,
        isGuest: false,
      },
      context: {
        hasAdminAccess: false,
        hasReaderIdentity: true,
        isGuest: false,
        readerId: readerUser.id,
        authProvider: 'github',
        userRole: null,
      },
    })
  })

  test('derives admin access and reader identity from owner api key without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles-guard/probe',
      headers: {
        'x-test-api-key': 'txo-owner',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      decorator: {
        hasAdminAccess: true,
        hasReaderIdentity: true,
        isGuest: false,
      },
      context: {
        hasAdminAccess: true,
        hasReaderIdentity: true,
        isGuest: false,
        readerId: ownerUser.id,
        authProvider: null,
        userRole: 'owner',
      },
    })
  })

  test('does not grant admin access for invalid api key and falls back to guest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles-guard/probe',
      headers: {
        'x-test-api-key': 'invalid-token',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      decorator: {
        hasAdminAccess: false,
        hasReaderIdentity: false,
        isGuest: true,
      },
      context: {
        hasAdminAccess: false,
        hasReaderIdentity: false,
        isGuest: true,
        readerId: null,
        authProvider: null,
        userRole: null,
      },
    })
  })
})
