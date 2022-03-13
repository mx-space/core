import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { getModelToken } from 'nestjs-typegoose'
import { dbHelper } from 'test/helper/db-mock.helper'
import { MockCacheService, redisHelper } from 'test/helper/redis-mock.helper'
import { setupE2EApp } from 'test/helper/register-app.helper'
import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { CacheService } from '~/processors/cache/cache.service'
import { DatabaseService } from '~/processors/database/database.service'

describe('test /snippets', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    await dbHelper.connect()
  })

  afterAll(async () => {
    await dbHelper.clear()
    await dbHelper.close()
  })
  const model = getModelForClass(SnippetModel)

  const mockPayload1: Partial<SnippetModel> = Object.freeze({
    name: 'Snippet_1',
    private: false,
    raw: JSON.stringify({ foo: 'bar' }),
    type: SnippetType.JSON,
  })
  let redisService: MockCacheService

  afterAll(async () => {
    await (await redisHelper).close()
  })
  beforeAll(async () => {
    const { CacheService: redisService$ } = await redisHelper

    redisService = redisService$

    const ref = await Test.createTestingModule({
      controllers: [SnippetController],
      providers: [
        SnippetService,
        { provide: DatabaseService, useValue: {} },
        { provide: CacheService, useValue: redisService },
        {
          provide: ServerlessService,
          useValue: {
            isValidServerlessFunction() {
              return true
            },
          },
        },
        {
          provide: getModelToken(SnippetModel.name),
          useValue: model,
        },
      ],
    }).compile()

    app = await setupE2EApp(ref)
  })

  test('POST /snippets, should 422 with wrong name', async () => {
    await app
      .inject({
        method: 'POST',
        url: '/snippets',
        payload: {
          name: 'Snippet*1',
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
  let id: string
  test('POST /snippets, should create successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/snippets',
      payload: mockPayload1,
    })
    expect(res.statusCode).toBe(201)
    const data = await res.json()
    expect(data.name).toEqual(mockPayload1.name)
    expect(data.id).toBeDefined()
    id = data.id
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
        url: '/snippets/' + id,
      })
      .then((res) => {
        const json = res.json()
        expect(res.statusCode).toBe(200)
        expect(json.name).toBe('Snippet_1')
        expect(json.raw).toBe(mockPayload1.raw)
      })
  })

  test('GET /snippets/:reference/:name, should return 200', async () => {
    await app
      .inject({
        method: 'GET',
        url: '/snippets/root/' + mockPayload1.name,
      })
      .then((res) => {
        const json = res.json()
        expect(res.statusCode).toBe(200)

        expect(json).toStrictEqual(JSON.parse(mockPayload1.raw))
      })
  })

  const snippetFuncType = {
    type: SnippetType.Function,
    raw: async function handler(context, require) {
      return 1 + 1
    }.toString(),
    name: 'func-1',
    private: false,
    reference: 'root',
  }

  test('POST /snippets, should create function successfully', async () => {
    await app
      .inject({
        method: 'POST',
        url: '/snippets',
        payload: {
          ...snippetFuncType,
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(201)
      })
  })

  test('GET /snippets/root/func-1', async () => {
    await app
      .inject({
        method: 'GET',
        url: '/snippets/root/func-1',
      })
      .then((res) => {
        expect(res.statusCode).toBe(404)
      })
  })
})
