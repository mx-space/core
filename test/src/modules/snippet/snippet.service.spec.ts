import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { getModelToken } from 'nestjs-typegoose'
import { dbHelper } from 'test/helper/db-mock.helper'
import { createMockedContextResponse } from '~/modules/snippet/mock-response.util'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { CacheService } from '~/processors/cache/cache.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { HttpService } from '~/processors/helper/helper.http.service'

describe('test Snippet Service', () => {
  let service: SnippetService

  beforeAll(async () => {
    await dbHelper.connect()
    const moduleRef = Test.createTestingModule({
      providers: [
        SnippetService,
        AssetService,
        HttpService,
        { provide: CacheService, useValue: {} },
        {
          provide: getModelToken('SnippetModel'),
          useValue: getModelForClass(SnippetModel),
        },
      ],
    })

    const app = await moduleRef.compile()
    await app.init()
    service = app.get(SnippetService)
  })

  afterAll(async () => {
    await dbHelper.close()
  })

  const snippet = {
    name: 'test',
    raw: '{"foo": "bar"}',
    type: SnippetType.JSON,
    private: false,
    reference: 'root',
  }
  let id = ''
  it('should create one', async () => {
    const res = await service.create(snippet)

    expect(res).toMatchObject(snippet)
    expect(res.id).toBeDefined()

    id = res.id
  })

  it('should not allow duplicate create', async () => {
    await expect(service.create(snippet)).rejects.toThrow(BadRequestException)
  })

  test('get snippet by name', async () => {
    const res = await service.getSnippetByName(snippet.name, snippet.reference)
    expect(res.name).toBe(snippet.name)
  })

  test('get full snippet', async () => {
    const res = await service.getSnippetById(id)
    expect(res.name).toBe(snippet.name)
  })

  describe('run serverless function', () => {
    test('case-1', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return 1 + 1
        }.toString(),
      })
      const data = await service.injectContextIntoServerlessFunctionAndCall(
        model,
        { req: {} as any, res: {} as any },
      )
      expect(data).toBe(2)
    })

    test('case-2: require built-in module', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return (await require('path')).join('1', '1')
        }.toString(),
      })
      const data = await service.injectContextIntoServerlessFunctionAndCall(
        model,
        { req: {} as any, res: {} as any },
      )
      expect(data).toBe('1/1')
    })

    test('case-3: require extend module', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return (await require('axios')).get.toString()
        }.toString(),
      })
      const data = await service.injectContextIntoServerlessFunctionAndCall(
        model,
        { req: {} as any, res: {} as any },
      )
      expect(data).toBeDefined()
    })

    test('case-4: require ban module', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return await require('os')
        }.toString(),
      })

      expect(
        service.injectContextIntoServerlessFunctionAndCall(model, {
          req: {} as any,
          res: {} as any,
        }),
      ).rejects.toThrow()
    })

    test('case-5: require ban extend module', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return await require('@nestjs/core')
        }.toString(),
      })

      expect(
        service.injectContextIntoServerlessFunctionAndCall(model, {
          req: {} as any,
          res: {} as any,
        }),
      ).rejects.toThrow()
    })

    test('case-6: throws', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return context.throws(404, 'not found')
        }.toString(),
      })

      expect(
        service.injectContextIntoServerlessFunctionAndCall(model, {
          req: {} as any,
          res: createMockedContextResponse(),
        }),
      ).rejects.toThrow()
    })
  })

  test('modify', async () => {
    const newSnippet = {
      name: 'test',
      raw: '{"foo": "b"}',
      type: SnippetType.JSON,
      private: true,
      reference: 'root',
    }
    const res = await service.update(id, newSnippet)
    expect(res.raw).toBe(newSnippet.raw)
  })
  test('delete', async () => {
    await service.delete(id)
    await expect(service.getSnippetById(id)).rejects.toThrow(NotFoundException)
  })
})
