import { ValidationPipe } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TestingModule } from '@nestjs/testing'

import { fastifyApp } from '~/common/adapters/fastify.adapter'

export const setupE2EApp = async (module: TestingModule) => {
  const app = module.createNestApplication<NestFastifyApplication>(fastifyApp)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      errorHttpStatusCode: 422,
      forbidUnknownValues: true,
      enableDebugMessages: isDev,
      stopAtFirstError: true,
    }),
  )

  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}
