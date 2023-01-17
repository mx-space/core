import { createE2EApp } from 'test/helper/create-e2e-app'
import { gatewayProviders } from 'test/mock/modules/gateway.mock'
import { userProvider } from 'test/mock/modules/user.mock'

import { EventEmitter2 } from '@nestjs/event-emitter'
import { ReturnModelType } from '@typegoose/typegoose'

import { OptionModel } from '~/modules/configs/configs.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import {
  LinkController,
  LinkControllerCrud,
} from '~/modules/link/link.controller'
import { LinkModel, LinkState } from '~/modules/link/link.model'
import { LinkService } from '~/modules/link/link.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { EmailService } from '~/processors/helper/helper.email.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'

describe('Test LinkController(E2E)', () => {
  const proxy = createE2EApp({
    controllers: [LinkController, LinkControllerCrud],
    models: [LinkModel, OptionModel],
    providers: [
      ...gatewayProviders,
      LinkService,
      ConfigsService,
      EmailService,
      HttpService,
      EventManagerService,
      userProvider,
      SubPubBridgeService,
      AssetService,
      EventEmitter2,
    ],
    async pourData(modelMap) {
      const linkModel = modelMap.get(LinkModel)

      ;(linkModel.model as ReturnModelType<typeof LinkModel>).create({
        url: 'https://innei.ren',
        name: 'innei',
        avatar: 'https://innei.ren/avatar.png',
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
        url: 'https://innei.ren',
        name: 'innnnn',
        author: 'innei',
        avatar: 'https://innei.ren/avatar.png',
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
        url: 'https://innei.ren',
        name: 'innnnn',
        author: 'innei',
        avatar: 'https://innei.ren/avatar.png',
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
