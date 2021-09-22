import './utils/global.util'
import './zx.global'

import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { argv } from 'yargs'
import { API_VERSION, CROSS_DOMAIN } from './app.config'
import { AppModule } from './app.module'
import { fastifyApp } from './common/adapt/fastify'
import { SpiderGuard } from './common/guard/spider.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { MyLogger } from './processors/logger/logger.service'

const PORT: number = +argv.port || 2333

const Origin = CROSS_DOMAIN.allowedOrigins

declare const module: any

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    { logger: new MyLogger() },
  )

  const hosts = Origin.map((host) => new RegExp(host, 'i'))

  app.enableCors({
    origin: (origin, callback) => {
      const allow = hosts.some((host) => host.test(origin))

      callback(null, allow)
    },
    credentials: true,
  })

  app.setGlobalPrefix(isDev ? '' : `api/v${API_VERSION}`, {
    exclude: [{ path: '/qaqdmin', method: RequestMethod.GET }],
  })
  app.useGlobalInterceptors(new LoggingInterceptor())
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

  app.useGlobalGuards(new SpiderGuard())
  if (isDev) {
    const options = new DocumentBuilder()
      .setTitle('API')
      .setDescription('The blog API description')
      .setVersion(`${API_VERSION}`)
      .addSecurity('bearer', {
        type: 'http',
        scheme: 'bearer',
      })
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, options)
    SwaggerModule.setup('api-docs', app, document)
  }

  await app.listen(PORT, '0.0.0.0', async () => {
    if (isDev) {
      const url = await app.getUrl()
      Logger.debug(`OpenApi: ${url}/api-docs`)
      Logger.debug(`GraphQL playground: ${url}/graphql`)
      Logger.debug(`Admin Dashboard: ${url}/qaqdmin`)
      Logger.debug(`Server listen on: ${url}`)
    }

    Logger.log('Server is up.')
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(() => app.close())
  }
}
bootstrap()
