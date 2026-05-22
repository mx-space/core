import type { ModuleMetadata } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { AppExceptionFilter } from '~/common/filters/app-exception.filter'
import { HttpCacheInterceptor } from '~/common/interceptors/cache.interceptor'
import { DbQueryInterceptor } from '~/common/interceptors/db-query.interceptor'
import { ResponseInterceptorV2 } from '~/common/interceptors/response.interceptor'

import { redisHelper } from './redis-mock.helper'
import { setupE2EApp } from './setup-e2e'

export const createE2EApp = (module: ModuleMetadata) => {
  const proxy: {
    app: NestFastifyApplication
  } = {} as any

  beforeAll(async () => {
    const { CacheService, token } = await redisHelper
    const nestModule = module
    nestModule.providers ||= []

    nestModule.providers.push(
      {
        provide: APP_INTERCEPTOR,
        useClass: DbQueryInterceptor,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: HttpCacheInterceptor,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: ResponseInterceptorV2,
      },
      {
        provide: APP_FILTER,
        useClass: AppExceptionFilter,
      },
    )

    nestModule.providers.push({ provide: token, useValue: CacheService })
    const app = await setupE2EApp(nestModule)

    proxy.app = app
  })

  afterAll(async () => {
    // Close the app to ensure all pending async operations complete
    if (proxy.app) {
      await proxy.app.close()
    }
  })

  return proxy
}
