import { vitest as jest } from 'vitest'

import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'

import { SECURITY } from '~/app.config'
import { AuthService } from '~/modules/auth/auth.service'
import { JwtStrategy } from '~/modules/auth/jwt.strategy'
import { UserModel } from '~/modules/user/user.model'
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
    const __secret: any = SECURITY.jwtSecret || 'asjhczxiucipoiopiqm2376'

    const jwtModule = JwtModule.registerAsync({
      useFactory() {
        return {
          secret: __secret,
          signOptions: {
            expiresIn: SECURITY.jwtExpire,
            algorithm: 'HS256',
          },
        }
      },
    })

    const moduleRef = Test.createTestingModule({
      imports: [jwtModule, PassportModule],
      providers: [
        JwtStrategy,
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

  it('should sign token', async () => {
    const _token = await service.signToken('1')
    expect(_token).toBeDefined()
  })

  it('should verifyied', async () => {
    const user = await service.verifyPayload({
      _id: '1',
      authCode: 'authCode',
    })
    expect(user).toBeDefined()
    expect(user).toEqual(mockUser)
  })
})
