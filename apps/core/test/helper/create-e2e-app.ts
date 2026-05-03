import type { ModuleMetadata } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { HttpCacheInterceptor } from '~/common/interceptors/cache.interceptor'
import { DbQueryInterceptor } from '~/common/interceptors/db-query.interceptor'
import { JSONTransformInterceptor } from '~/common/interceptors/json-transform.interceptor'
import { ResponseInterceptor } from '~/common/interceptors/response.interceptor'

import { redisHelper } from './redis-mock.helper'
import { setupE2EApp } from './setup-e2e'

type ClassType = new (...args: any[]) => any

type ModelMap = Map<
  ClassType,
  {
    name: string
    model: never
  }
>
interface E2EAppMetaData {
  models?: ClassType[]
  pourData?: (modelMap: ModelMap) => Promise<void | (() => Promise<any>)>
}

export const createE2EApp = (module: ModuleMetadata & E2EAppMetaData) => {
  const proxy: {
    app: NestFastifyApplication
  } = {} as any

  let pourDataCleanup: (() => Promise<void>) | undefined

  beforeAll(async () => {
    const { CacheService, token } = await redisHelper
    const { models, pourData, ...nestModule } = module
    nestModule.providers ||= []

    nestModule.providers.push(
      {
        provide: APP_INTERCEPTOR,
        useClass: DbQueryInterceptor,
      },

      {
        provide: APP_INTERCEPTOR,
        useClass: HttpCacheInterceptor, // 5
      },

      {
        provide: APP_INTERCEPTOR,
        useClass: JSONTransformInterceptor, // 3
      },

      {
        provide: APP_INTERCEPTOR,
        useClass: ResponseInterceptor, // 1
      },
    )

    nestModule.providers.push({ provide: token, useValue: CacheService })
    const modelMap = new Map() as ModelMap
    // TODO(wave-5): refactor E2E fixtures to seed through PG repositories.
    models?.forEach((model) => {
      modelMap.set(model, {
        name: model.name,
        model: undefined as never,
      })
    })
    if (pourData) {
      const cleanup = await pourData(modelMap)
      // @ts-ignore
      pourDataCleanup = cleanup
    }
    const app = await setupE2EApp(nestModule)

    proxy.app = app
  })

  afterAll(async () => {
    if (pourDataCleanup) {
      await pourDataCleanup()
    }
    // Close the app to ensure all pending async operations complete
    if (proxy.app) {
      await proxy.app.close()
    }
  })

  return proxy
}
