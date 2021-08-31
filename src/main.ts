import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { fastifyApp } from './common/adapt/fastify'
import { isDev } from './utils/index.util'
import { CacheInterceptor, Logger } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { CROSS_DOMAIN } from './app.config'
import {
  JSONSerializeInterceptor,
  ResponseInterceptor,
} from './common/interceptors/response.interceptors'
import { SpiderGuard } from './common/guard/spider.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
// const PORT = parseInt(process.env.PORT) || 2333
const PORT = 2333
const APIVersion = 1
const Origin = CROSS_DOMAIN.allowedOrigins
declare const module: any

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
  )

  const hosts = Origin.map((host) => new RegExp(host, 'i'))

  app.enableCors({
    origin: (origin, callback) => {
      const allow = hosts.some((host) => host.test(origin))

      callback(null, allow)
    },
    credentials: true,
  })

  app.setGlobalPrefix(isDev ? '' : `api/v${APIVersion}`)
  app.useGlobalInterceptors(new ResponseInterceptor())
  app.useGlobalInterceptors(new JSONSerializeInterceptor())
  app.useGlobalInterceptors(new LoggingInterceptor())
  app.useGlobalGuards(new SpiderGuard())
  if (isDev) {
    const options = new DocumentBuilder()
      .setTitle('API')
      .setDescription('The blog API description')
      .setVersion(`${APIVersion}`)
      .addSecurity('bearer', {
        type: 'http',
        scheme: 'bearer',
      })
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, options)
    SwaggerModule.setup('api-docs', app, document)
  }

  await app.listen(PORT, '0.0.0.0', () => {
    if (isDev) {
      Logger.debug(`http://localhost:${PORT}/api-docs`)
    }

    Logger.log('Server is up.')
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(() => app.close())
  }
}
bootstrap()
