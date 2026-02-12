import { createMockGlobalModule } from '@/helper/create-mock-global-module'
import { configProvider } from '@/mock/modules/config.mock'
import { Test } from '@nestjs/testing'
import { AuthService } from '~/modules/auth/auth.service'
import { OwnerController } from '~/modules/owner/owner.controller'
import { OwnerService } from '~/modules/owner/owner.service'

describe('test OwnerController', () => {
  let controller: OwnerController

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OwnerController],
      imports: [createMockGlobalModule([])],
      providers: [OwnerService, AuthService, configProvider],
    })
      .overrideProvider(OwnerService)
      .useValue({
        getOwnerInfo(getLoginIp: boolean) {
          const base = {
            id: '1',
            name: 'owner',
          } as any
          if (getLoginIp) {
            base.lastLoginIp = '1.1.1.1'
          }
          return base
        },
      })
      .overrideProvider(AuthService)
      .useValue({})
      .compile()
    controller = module.get<OwnerController>(OwnerController)
  })

  it('getOwnerInfo should hide loginIp for visitors', async () => {
    const res = await controller.getOwnerInfo(false)
    expect(res.lastLoginIp).toBeUndefined()
  })

  it('getOwnerInfo should show loginIp for authenticated', async () => {
    const res = await controller.getOwnerInfo(true)
    expect(res.lastLoginIp).toBe('1.1.1.1')
  })
})
