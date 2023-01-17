import { createE2EApp } from 'test/helper/e2e-create-app'

import { NestFastifyApplication } from '@nestjs/platform-fastify'

import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetController } from '~/modules/snippet/snippet.controller'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { DatabaseService } from '~/processors/database/database.service'

describe('test /snippets', () => {
  let app: NestFastifyApplication
  const proxy = createE2EApp({
    controllers: [SnippetController],
    providers: [
      SnippetService,
      { provide: DatabaseService, useValue: {} },

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
        url: `/snippets/${id}`,
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
