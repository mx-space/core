import type { ModuleMetadata } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test, TestingModule } from '@nestjs/testing'
import { fastifyApp } from '~/common/adapters/fastify.adapter'

export const setupE2EApp = async (module: TestingModule | ModuleMetadata) => {
  let nextModule: TestingModule
  if (module instanceof TestingModule) {
    nextModule = module
  } else {
    nextModule = await Test.createTestingModule(module).compile()
  }

  const app =
    nextModule.createNestApplication<NestFastifyApplication>(fastifyApp)
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
