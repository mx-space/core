import { redisHelper } from '@/helper/redis-mock.helper'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { ReturnModelType } from '@typegoose/typegoose'
import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'

describe('test /snippets', async () => {
  let app: NestFastifyApplication
  let model: ReturnModelType<typeof SnippetModel>
  const proxy = createE2EApp({
    controllers: [SnippetController],
    providers: [
      SnippetService,
      { provide: DatabaseService, useValue: {} },
      {
        provide: RedisService,
        useValue: (await redisHelper).RedisService,
      },
      {
        provide: EventManagerService,
        useValue: {
          async emit() {},
        },
      },

      {
        provide: ServerlessService,
        useValue: {
          isValidServerlessFunction() {
            return true
          },
        },
      },
    ],
    models: [SnippetModel],
    async pourData(modelMap) {
      model = modelMap.get(SnippetModel).model as ReturnModelType<
        typeof SnippetModel
      >
    },
  })

  const mockPayload1: Partial<SnippetModel> = Object.freeze({
    name: 'Snippet_1',
    private: false,
    raw: JSON.stringify({ foo: 'bar' }),
    type: SnippetType.JSON,
  })

  beforeEach(() => {
    app = proxy.app
  })

  test('POST /snippets, should 422 with wrong name', async () => {
    await app
      .inject({
        method: 'POST',
        url: '/snippets',
        headers: {
          ...authPassHeader,
        },
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
      headers: {
        ...authPassHeader,
      },
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
        headers: {
          ...authPassHeader,
        },
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
        url: `/snippets/${id}`,
        headers: {
          ...authPassHeader,
        },
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
        url: `/snippets/root/${mockPayload1.name}`,
      })
      .then((res) => {
        const json = res.json()
        expect(res.statusCode).toBe(200)

        expect(json).toStrictEqual(JSON.parse(mockPayload1.raw || '{}'))
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
        headers: {
          ...authPassHeader,
        },
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

  test('POST /snippets, can not create function with reserved reference', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/snippets',
      payload: {
        ...snippetFuncType,
        reference: 'built-in',
      },
      headers: {
        ...authPassHeader,
      },
    })
    expect(result.statusCode).toBe(400)
  })

  test('DEL /snippets/:id, should throw if delete built-in', async () => {
    const doc = await model.create({
      ...snippetFuncType,
      reference: 'built-in',
    })
    const result = await app.inject({
      method: 'DELETE',
      url: `/snippets/${doc.id}`,
      headers: {
        ...authPassHeader,
      },
    })
    expect(result.statusCode).toBe(400)
  })

  test('PUT /snippets/:id, modify built-in function', async () => {
    const doc = await model.create({
      ...snippetFuncType,
      reference: 'built-in',
      name: 'test',
    })
    const result = await app.inject({
      method: 'PUT',
      url: `/snippets/${doc.id}`,
      payload: {
        // @ts-ignore
        ...doc.toObject(),
        raw: `export default async function handler(context, require) { return null }`,
      },
      headers: {
        ...authPassHeader,
      },
    })

    expect(result.statusCode).toBe(200)
  })
})
