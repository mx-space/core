import { createMockGlobalModule } from '@/helper/create-mock-global-module'
import { configProvider } from '@/mock/modules/config.mock'
import type { ServerResponse } from 'node:http'
import { Test } from '@nestjs/testing'
import { RequestContext } from '~/common/contexts/request.context'
import { AuthService } from '~/modules/auth/auth.service'
import { OwnerController } from '~/modules/owner/owner.controller'
import { OwnerService } from '~/modules/owner/owner.service'
import type { BizIncomingMessage } from '~/transformers/get-req.transformer'

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
    const request = {
      hasAdminAccess: false,
      hasReaderIdentity: false,
      isAuthenticated: false,
      isGuest: true,
    } as BizIncomingMessage
    const response = {} as ServerResponse

    const res = await RequestContext.run(new RequestContext(request, response), () =>
      controller.getOwnerInfo(),
    )

    expect(res.lastLoginIp).toBeUndefined()
  })

  it('getOwnerInfo should show loginIp for authenticated', async () => {
    const request = {
      hasAdminAccess: true,
      hasReaderIdentity: true,
      isAuthenticated: true,
      isGuest: false,
      readerId: 'owner-1',
    } as BizIncomingMessage
    const response = {} as ServerResponse

    const res = await RequestContext.run(new RequestContext(request, response), () =>
      controller.getOwnerInfo(),
    )

    expect(res.lastLoginIp).toBe('1.1.1.1')
  })
})
