import { ModuleMetadata } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'

import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { getModelToken } from '~/transformers/model.transformer'

import { dbHelper } from './db-mock.helper'
import { redisHelper } from './redis-mock.helper'

type ClassType = new (...args: any[]) => any
export const createE2EApp = (
  module: ModuleMetadata,
  injectModels?: ClassType[],
) => {
  let app: NestFastifyApplication

  afterAll(async () => {
    await dbHelper.close()
    await (await redisHelper).close()
  })

  beforeAll(async () => {
    await dbHelper.connect()
    const { CacheService, token } = await redisHelper

    module.providers ||= []
    module.providers.push({ provide: token, useValue: CacheService })

    if (injectModels) {
      injectModels.forEach((model) => {
        module.providers.push({
          provide: getModelToken(model.name),
          useValue: dbHelper.getModel(model),
        })
      })
    }

    const moduleRef = await Test.createTestingModule(module).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  return {
    app,
  }
}
