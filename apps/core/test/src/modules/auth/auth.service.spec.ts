import { configProvider } from '@/mock/modules/config.mock'
import { Test } from '@nestjs/testing'
import { AuthInstanceInjectKey } from '~/modules/auth/auth.constant'
import { AuthService } from '~/modules/auth/auth.service'
import { UserModel } from '~/modules/user/user.model'
import { DatabaseService } from '~/processors/database/database.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getModelToken } from '~/transformers/model.transformer'
import { vi } from 'vitest'

describe('Test AuthService', () => {
  let service: AuthService

  const mockUser = {
    _id: '1',
    id: '1',
    username: 'test-user',
    email: 'tukon@gmail.com',
  }
  beforeAll(async () => {
    const moduleRef = Test.createTestingModule({
      providers: [
        { provide: CacheService, useValue: {} },
        {
          provide: JWTService,
          useValue: {
            sign() {
              return 'fake token'
            },
          },
        },
        configProvider,
        AuthService,
        {
          provide: AuthInstanceInjectKey,
          useValue: {},
        },
        {
          provide: DatabaseService,
          useValue: {
            db: {},
          },
        },
        {
          provide: getModelToken(UserModel.name),
          useValue: {
            findById: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                ...mockUser,
              }),
            }),
          },
        },
      ],
    })

    const app = await moduleRef.compile()
    await app.init()
    service = app.get(AuthService)
  })

  it('should sign token', () => {
    const _token = service.jwtServicePublic.sign('1')
    expect(_token).toBeDefined()
  })
})
