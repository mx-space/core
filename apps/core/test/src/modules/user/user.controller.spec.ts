import { configProvider } from '@/mock/modules/config.mock'
import { Test } from '@nestjs/testing'

import { AuthService } from '~/modules/auth/auth.service'
import { UserController } from '~/modules/user/user.controller'
import { UserService } from '~/modules/user/user.service'
import { CacheService } from '~/processors/redis/cache.service'

describe('test UserModule controller', () => {
  let userController: UserController

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        AuthService,
        { provide: CacheService, useValue: {} },
        configProvider,
      ],
    })
      .overrideProvider(UserService)
      .useValue({
        getMasterInfo(isMaster) {
          const base = {
            id: 1,
            name: 'master',
          } as any
          if (isMaster) {
            base.lastLoginIp = '1.1.1.1'
          }
          return base as any
        },
        createMaster() {
          return {}
        },
      })
      .overrideProvider(AuthService)
      .useValue({})
      .compile()
    userController = module.get<UserController>(UserController)
  })
  it('getMasterInfo', async () => {
    const resA = await userController.getMasterInfo(false)
    const resB = await userController.getMasterInfo(true)
    expect(resA.lastLoginIp).toBe(undefined)
    expect(resB.lastLoginIp).toBe('1.1.1.1')
  })
})
