import { createE2EApp } from 'test/helper/create-e2e-app'
import { authProvider } from 'test/mock/modules/auth.mock'
import { commentProvider } from 'test/mock/modules/comment.mock'
import { configProvider } from 'test/mock/modules/config.mock'
import { gatewayProviders } from 'test/mock/modules/gateway.mock'
import { countingServiceProvider } from 'test/mock/processors/counting.mock'

import { EventEmitter2 } from '@nestjs/event-emitter'
import { ReturnModelType } from '@typegoose/typegoose'

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

import MockDbData from './note.e2e-mock.db'

describe('NoteController (e2e)', () => {
  let model: ReturnModelType<typeof NoteModel>
  const proxy = createE2EApp({
    controllers: [NoteController],
    providers: [
      NoteService,
      ImageService,
      EventManagerService,
      commentProvider,

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
    async pourData(modelMap) {
      // @ts-ignore
      const { model: _model } = modelMap.get(NoteModel) as {
        model: ReturnModelType<typeof NoteModel>
      }
      model = _model
      for await (const data of MockDbData) {
        await _model.create(data)
      }
    },
  })

  afterAll(async () => {
    await model.deleteMany({})
  })

  test('GET /notes', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'GET',
      url: '/notes',
    })
    const data = res.json()
    expect(res.statusCode).toBe(200)

    data.data.forEach((d) => {
      delete d.id
      delete d._id
    })
    expect(data).toMatchSnapshot()
  })

  const createdNoteData: Partial<NoteModel> = {
    title: 'Note 2',
    text: 'Content 2',

    allowComment: true,
    // use cutsom date
    created: new Date('2023-01-17T11:01:57.851Z'),
  }

  test('POST /notes', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'POST',
      url: '/notes',
      payload: createdNoteData,
    })

    const data = res.json()
    expect(res.statusCode).toBe(201)
    createdNoteData.id = data.id
    createdNoteData.nid = data.nid
    delete data.id
    expect(data).toMatchSnapshot()
  })

  test('PATCH /notes/:id', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'PATCH',
      url: `/notes/${createdNoteData.id}`,
      payload: {
        title: 'Note 2 (updated)',
        text: `Content 2 (updated)`,
        mood: 'happy',
        weather: 'sunny',
      },
    })

    expect(res.statusCode).toBe(204)
  })

  test('Get patched note', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'GET',
      url: `/notes/${createdNoteData.id}`,
    })

    expect(res.statusCode).toBe(200)
    const data = res.json()
    delete data.id
    expect(data).toMatchSnapshot()
  })

  test('GET /list/:id', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'GET',
      url: `/notes/list/${createdNoteData.id}`,
    })

    expect(res.statusCode).toBe(200)
    const data = res.json()

    data.data.forEach((note) => {
      delete note.id
    })

    expect(data).toMatchSnapshot()
  })

  test('DEL /notes/:id', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'DELETE',
      url: `/notes/${createdNoteData.id}`,
    })

    expect(res.statusCode).toBe(204)
  })

  it('should got 404 when get deleted note', async () => {
    const { app } = proxy
    {
      const res = await app.inject({
        method: 'GET',
        url: `/notes/${createdNoteData.id}`,
      })

      expect(res.statusCode).toBe(404)
    }
    {
      const res = await app.inject({
        method: 'GET',
        url: `/notes/nid/${createdNoteData.nid}`,
      })

      expect(res.statusCode).toBe(404)
    }
  })

  test('GET /latest', async () => {
    const { app } = proxy
    const res = await app.inject({
      method: 'GET',
      url: '/notes/latest',
    })

    expect(res.statusCode).toBe(200)
    const data = res.json()
    delete data.data.id
    delete data.next.id
    expect(data).toMatchSnapshot()
  })
})
