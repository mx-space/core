import { ModuleMetadata } from '@nestjs/common'
import { NestFastifyApplication } from '@nestjs/platform-fastify'

import { getModelToken } from '~/transformers/model.transformer'

import { dbHelper } from './db-mock.helper'
import { redisHelper } from './redis-mock.helper'
import { setupE2EApp } from './setup-e2e'

type ClassType = new (...args: any[]) => any
export const createE2EApp = (
  module: ModuleMetadata & { models?: ClassType[] },
) => {
  const proxy: {
    app: NestFastifyApplication
  } = {} as any

  beforeAll(async () => {
    const { CacheService, token } = await redisHelper
    const { models, ...nestModule } = module
    nestModule.providers ||= []
    nestModule.providers.push({ provide: token, useValue: CacheService })

    if (models) {
      models.forEach((model) => {
        nestModule.providers.push({
          provide: getModelToken(model.name),
          useValue: dbHelper.getModel(model),
        })
      })
    }

    const app = await setupE2EApp(nestModule)

    proxy.app = app
  })

  return proxy
}
