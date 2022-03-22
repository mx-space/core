import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { dbHelper } from 'test/helper/db-mock.helper'
import { getModelToken } from '~/transformers/model.transformer'
import { createMockedContextResponse } from '~/modules/serverless/mock-response.util'
import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { CacheService } from '~/processors/cache/cache.service'
import { DatabaseService } from '~/processors/database/database.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { HttpService } from '~/processors/helper/helper.http.service'

describe('test serverless function service', () => {
  let service: ServerlessService

  beforeAll(async () => {
    await dbHelper.connect()
    const moduleRef = Test.createTestingModule({
      providers: [
        ServerlessService,
        HttpService,
        AssetService,
        {
          provide: CacheService,
          useValue: {},
        },
        { provide: DatabaseService, useValue: {} },

        {
          provide: getModelToken('SnippetModel'),
          useValue: getModelForClass(SnippetModel),
        },
      ],
    })

    const app = await moduleRef.compile()
    await app.init()
    service = app.get(ServerlessService)
  })

  afterAll(async () => {
    await dbHelper.clear()
    await dbHelper.close()
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
          res: createMockedContextResponse({} as any),
        }),
      ).rejects.toThrow()
    })
  })

  test('case-7: esm default import', async () => {
    const model = new SnippetModel()
    Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
      type: SnippetType.Function,
      raw: `import axios from 'axios';async function handler(context, require) { return axios }`,
    })
    const data = await service.injectContextIntoServerlessFunctionAndCall(
      model,
      { req: {} as any, res: {} as any },
    )
    expect(typeof data.get).toBe('function')
  })

  test('case-7: esm named import', async () => {
    const model = new SnippetModel()
    Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
      type: SnippetType.Function,
      raw: `import {get} from 'axios';async function handler(context, require) { return get }`,
    })
    const data = await service.injectContextIntoServerlessFunctionAndCall(
      model,
      { req: {} as any, res: {} as any },
    )
    expect(typeof data).toBe('function')
  })
})
