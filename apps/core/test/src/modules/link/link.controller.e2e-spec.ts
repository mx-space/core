import { createE2EApp } from 'test/helper/create-e2e-app'
import { gatewayProviders } from 'test/mock/modules/gateway.mock'
import { userProvider } from 'test/mock/modules/user.mock'
import { emailProvider } from 'test/mock/processors/email.mock'
import { eventEmitterProvider } from 'test/mock/processors/event.mock'
import type { ReturnModelType } from '@typegoose/typegoose'

import { createRedisProvider } from '@/mock/modules/redis.mock'

import { ExtendedValidationPipe } from '~/common/pipes/validation.pipe'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { OptionModel } from '~/modules/configs/configs.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import {
  LinkController,
  LinkControllerCrud,
} from '~/modules/link/link.controller'
import { LinkModel, LinkState } from '~/modules/link/link.model'
import { LinkService } from '~/modules/link/link.service'
import { HttpService } from '~/processors/helper/helper.http.service'

describe('Test LinkController(E2E)', async () => {
  const proxy = createE2EApp({
    controllers: [LinkController, LinkControllerCrud],
    models: [LinkModel, OptionModel],
    providers: [
      ...gatewayProviders,
      LinkService,

      emailProvider,
      HttpService,

      userProvider,
      await createRedisProvider(),
      ConfigsService,
      ...eventEmitterProvider,
      {
        provide: VALIDATION_PIPE_INJECTION,
        useValue: ExtendedValidationPipe.shared,
      },
    ],
    async pourData(modelMap) {
      const linkModel = modelMap.get(LinkModel)

      ;(linkModel.model as ReturnModelType<typeof LinkModel>).create({
        url: 'https://innei.in',
        name: 'innei',
        avatar: 'https://innei.in/avatar.png',
        description: 'innei',
        state: LinkState.Outdate,
      })
    },
  })

  it('should change state to audit', async () => {
    const app = proxy.app
    const res = await app.inject({
      method: 'post',
      url: '/links/audit',
      payload: {
        url: 'https://innei.in',
        name: 'innnnn',
        author: 'innei',
        avatar: 'https://innei.in/avatar.png',
        description: 'innei',
      },
    })
    expect(res.statusCode).toBe(204)
  })

  it('apply link repeat should throw', async () => {
    const app = proxy.app
    const res = await app.inject({
      method: 'post',
      url: '/links/audit',
      payload: {
        url: 'https://innei.in',
        name: 'innnnn',
        author: 'innei',
        avatar: 'https://innei.in/avatar.png',
        description: 'innei',
      },
    })
    expect(res.json()).toMatchInlineSnapshot(`
          {
            "error": "Bad Request",
            "message": "请不要重复申请友链哦",
            "statusCode": 400,
          }
        `)
  })
})
