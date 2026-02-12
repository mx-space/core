import type { ModuleMetadata } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test, TestingModule } from '@nestjs/testing'
import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { AuthGuard } from '~/common/guards/auth.guard'
import { extendedZodValidationPipeInstance } from '~/common/zod'
import { AuthTestingGuard } from 'test/mock/guard/auth.guard'

export const setupE2EApp = async (module: TestingModule | ModuleMetadata) => {
  let nextModule: TestingModule
  if (module instanceof TestingModule) {
    nextModule = module
  } else {
    nextModule = await Test.createTestingModule(module)
      .overrideGuard(AuthGuard)
      .useClass(AuthTestingGuard)
      .compile()
  }

  const app =
    nextModule.createNestApplication<NestFastifyApplication>(fastifyApp)
  app.useGlobalPipes(extendedZodValidationPipeInstance)

  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}
