import { Test } from '@nestjs/testing'

import { AuthService } from '~/modules/auth/auth.service'
import { UserModel } from '~/modules/user/user.model'
import { CacheService } from '~/processors/cache/cache.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'
import { getModelToken } from '~/transformers/model.transformer'

describe('Test AuthService', () => {
  let service: AuthService

  const mockUser = {
    _id: '1',
    id: '1',
    username: 'test-user',
    email: 'tukon@gmail.com',
    authCode: 'authCode',
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
        AuthService,
        {
          provide: getModelToken(UserModel.name),
          useValue: {
            findById: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
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
