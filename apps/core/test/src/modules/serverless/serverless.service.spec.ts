import mongoose from 'mongoose'
import { redisHelper } from 'test/helper/redis-mock.helper'

import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'

import { ConfigsService } from '~/modules/configs/configs.service'
import { createMockedContextResponse } from '~/modules/serverless/mock-response.util'
import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { DatabaseService } from '~/processors/database/database.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { HttpService } from '~/processors/helper/helper.http.service'
import { RedisService } from '~/processors/redis/redis.service'
import { getModelToken } from '~/transformers/model.transformer'

describe('test serverless function service', () => {
  let service: ServerlessService

  beforeAll(async () => {
    const moduleRef = Test.createTestingModule({
      providers: [
        ServerlessService,
        HttpService,
        AssetService,
        {
          provide: RedisService,
          useValue: (await redisHelper).RedisService,
        },
        {
          provide: DatabaseService,
          useValue: {
            db: mongoose.connection.db,
          },
        },

        {
          provide: getModelToken('SnippetModel'),
          useValue: getModelForClass(SnippetModel),
        },
        {
          provide: ConfigsService,
          useValue: {},
        },
        {
          provide: EventManagerService,
          useValue: {
            broadcast: () => void 0,
          },
        },
      ],
    })

    const app = await moduleRef.compile()
    await app.init()
    service = app.get(ServerlessService)
  })

  describe('run serverless function', () => {
    test('case-1', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler() {
          return 1 + 1
        }.toString(),
      })
      const data = await service.injectContextIntoServerlessFunctionAndCall(
        model,
        { req: {} as any, res: {} as any, isAuthenticated: false },
      )
      expect(data).toBe(2)
    })

    test('case-2: require built-in module', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return (await require('node:path')).join('1', '1')
        }.toString(),
      })
      const data = await service.injectContextIntoServerlessFunctionAndCall(
        model,
        { req: {} as any, res: {} as any, isAuthenticated: false },
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
        { req: {} as any, res: {} as any, isAuthenticated: false },
      )
      expect(data).toBeDefined()
    })

    test('case-4: require ban module', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context, require) {
          return await require('node:os')
        }.toString(),
      })

      expect(
        service.injectContextIntoServerlessFunctionAndCall(model, {
          req: {} as any,
          res: {} as any,
          isAuthenticated: false,
        }),
      ).rejects.toThrow()
    })

    // test('case-5: require ban extend module', async () => {
    //   const model = new SnippetModel()
    //   Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
    //     type: SnippetType.Function,
    //     raw: async function handler(context, require) {
    //       return await require('@nestjs/core')
    //     }.toString(),
    //   })

    //   expect(
    //     service.injectContextIntoServerlessFunctionAndCall(model, {
    //       req: {} as any,
    //       res: {} as any,
    //     }),
    //   ).rejects.toThrow()
    // })

    test('case-6: throws', async () => {
      const model = new SnippetModel()
      Object.assign<SnippetModel, Partial<SnippetModel>>(model, {
        type: SnippetType.Function,
        raw: async function handler(context) {
          return context.throws(404, 'not found')
        }.toString(),
      })

      expect(
        service.injectContextIntoServerlessFunctionAndCall(model, {
          req: {} as any,
          res: createMockedContextResponse({} as any),
          isAuthenticated: false,
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
      { req: {} as any, res: {} as any, isAuthenticated: false },
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
      { req: {} as any, res: {} as any, isAuthenticated: false },
    )
    expect(typeof data).toBe('function')
  })

  test('case-8: reset built-in function', async () => {
    const model = service.model
    await model.updateOne(
      {
        name: 'ip',
      },
      { raw: '`' },
    )
    expect(
      (
        await model
          .findOne({
            name: 'ip',
          })
          .lean()
      ).raw,
    ).toEqual('`')
    await service.resetBuiltInFunction({
      name: 'ip',
      reference: 'built-in',
    })
    expect(
      (
        await model
          .findOne({
            name: 'ip',
          })
          .lean()
      ).raw,
    ).not.toEqual('`')
  })
})
