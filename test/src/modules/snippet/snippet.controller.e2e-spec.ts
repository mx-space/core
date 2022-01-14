import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { getModelToken } from 'nestjs-typegoose'
import { setupE2EApp } from 'test/helper/register-app.helper'
import { firstKeyOfMap } from 'test/helper/utils.helper'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'

const mockingoose = require('mockingoose')

describe.only('test /snippets', () => {
  let app: NestFastifyApplication
  const model = getModelForClass(SnippetModel)

  const mockTable = new Map()

  const mockPayload1: Partial<SnippetModel> = Object.freeze({
    name: 'Snippet_1',
    private: false,
    raw: JSON.stringify({ foo: 'bar' }),
    type: SnippetType.JSON,
  })

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      controllers: [SnippetController],
      providers: [
        SnippetService,
        {
          provide: getModelToken(SnippetModel.name),
          useValue: model,
        },
      ],
    }).compile()

    app = await setupE2EApp(ref)
  })

  beforeEach(() => {
    mockingoose(model).toReturn(
      {
        ...mockPayload1,
        _id: '61dfc5e1db3c871756fa5f9c',
      },
      'findOne',
    )
    mockingoose(model).toReturn(
      {
        ...mockPayload1,
        _id: '61dfc5e1db3c871756fa5f9c',
      },
      'countDocuments',
    )
    mockTable.set('61dfc5e1db3c871756fa5f9c', {
      ...mockPayload1,
      _id: '121212',
    })
  })

  test('POST /snippets, should 422 with wrong name', async () => {
    await app
      .inject({
        method: 'POST',
        url: '/snippets',
        payload: {
          name: 'Snippet-1',
          private: false,
          raw: JSON.stringify({ foo: 'bar' }),
          type: SnippetType.JSON,
        } as SnippetModel,
      })
      .then((res) => {
        // name is wrong format
        expect(res.statusCode).toBe(422)
      })
  })

  test('POST /snippets, re-create same of name should return 400', async () => {
    await app
      .inject({
        method: 'POST',
        url: '/snippets',
        payload: {
          name: 'Snippet_1',
          private: false,
          raw: JSON.stringify({ foo: 'bar' }),
          type: SnippetType.JSON,
        } as SnippetModel,
      })
      .then((res) => {
        expect(res.statusCode).toBe(400)
      })
  })

  test('GET /snippets/:id, should return 200', async () => {
    await app
      .inject({
        method: 'GET',
        url: '/snippets/' + firstKeyOfMap(mockTable),
      })
      .then((res) => {
        const json = res.json()
        expect(res.statusCode).toBe(200)
        expect(json.name).toBe('Snippet_1')
        expect(json.raw).toBe(mockPayload1.raw)

        expect(json.data).toEqual(JSON.parse(mockPayload1.raw))
      })
  })
})
