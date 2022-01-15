import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { performance } from 'perf_hooks'
import { API_VERSION, CROSS_DOMAIN, PORT } from './app.config'
import { AppModule } from './app.module'
import { fastifyApp } from './common/adapters/fastify.adapter'
import { SpiderGuard } from './common/guard/spider.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { MyLogger } from './processors/logger/logger.service'

const Origin = CROSS_DOMAIN.allowedOrigins

declare const module: any

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    { logger: ['error', 'debug'] },
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
  if (isDev) {
    app.useGlobalInterceptors(new LoggingInterceptor())
  }

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

  await app.listen(+PORT, '0.0.0.0', async (err, address) => {
    app.useLogger(app.get(MyLogger))
    consola.info('ENV:', process.env.NODE_ENV)
    const url = await app.getUrl()
    if (isDev) {
      consola.debug(`OpenApi: ${url}/api-docs`)
      consola.debug(`GraphQL playground: ${url}/graphql`)
    }
    consola.success(`Server listen on: ${url}`)
    consola.success(`Admin Dashboard: ${url}/qaqdmin`)
    Logger.log(
      'Server is up. ' + chalk.yellow('+' + (performance.now() | 0) + 'ms'),
    )
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(() => app.close())
  }
}
bootstrap()
