import { createE2EApp } from 'test/helper/e2e-create-app'
import { authProvider } from 'test/mock/modules/auth.mock'
import { configProvider } from 'test/mock/modules/config.mock'
import { gatewayProviders } from 'test/mock/modules/gateway.mock'
import { countingServiceProvider } from 'test/mock/processors/counting.mock'

import { EventEmitter2 } from '@nestjs/event-emitter'

import { CommentService } from '~/modules/comment/comment.service'
import { OptionModel } from '~/modules/configs/configs.model'
import { NoteController } from '~/modules/note/note.controller'
import { NoteModel } from '~/modules/note/note.model'
import { NoteService } from '~/modules/note/note.service'
import { UserModel } from '~/modules/user/user.model'
import { UserService } from '~/modules/user/user.service'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { TextMacroService } from '~/processors/helper/helper.macro.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'

describe('NoteController (e2e)', () => {
  const proxy = createE2EApp({
    controllers: [NoteController],
    providers: [
      NoteService,
      ImageService,
      EventManagerService,
      {
        provide: CommentService,
        useValue: {},
      },

      {
        provide: TextMacroService,
        useValue: {
          async replaceTextMacro(text) {
            return text
          },
        },
      },
      HttpService,
      configProvider,
      EventEmitter2,
      UserService,
      SubPubBridgeService,
      ...gatewayProviders,
      authProvider,
      CountingService,
      countingServiceProvider,
    ],
    imports: [],
    models: [NoteModel, OptionModel, UserModel],
  })

  test('GET /notes', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'GET',
      url: '/notes',
    })
    expect(res.statusCode).toBe(200)
  })
})
