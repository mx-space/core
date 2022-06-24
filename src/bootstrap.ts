import cluster from 'cluster'
import { performance } from 'perf_hooks'
import wcmatch from 'wildcard-match'

import { LogLevel, Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestFastifyApplication } from '@nestjs/platform-fastify'

import { API_VERSION, CROSS_DOMAIN, PORT, isMainProcess } from './app.config'
import { AppModule } from './app.module'
import { fastifyApp } from './common/adapters/fastify.adapter'
import { RedisIoAdapter } from './common/adapters/socket.adapter'
import { SpiderGuard } from './common/guard/spider.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { isTest } from './global/env.global'
import { MyLogger } from './processors/logger/logger.service'

const Origin: false | string[] = Array.isArray(CROSS_DOMAIN.allowedOrigins)
  ? [...CROSS_DOMAIN.allowedOrigins, '*.shizuri.net', '22333322.xyz']
  : false

declare const module: any

export async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    {
      logger: ['error'].concat(
        isDev ? (['debug'] as any as LogLevel[]) : ([] as LogLevel[]),
      ) as LogLevel[],
    },
  )

  // Origin 如果不是数组就全部允许跨域
  app.enableCors(
    Origin
      ? {
          origin: (origin, callback) => {
            let currentHost: string
            try {
              currentHost = new URL(origin).host
            } catch {
              currentHost = origin
            }
            const allow = Origin.some((host) => wcmatch(host)(currentHost))

            callback(null, allow)
          },
          credentials: true,
        }
      : undefined,
  )

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
  !isTest && app.useWebSocketAdapter(new RedisIoAdapter(app))

  if (isDev) {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger')
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

  await app.listen(+PORT, '0.0.0.0', async () => {
    app.useLogger(app.get(MyLogger))
    consola.info('ENV:', process.env.NODE_ENV)
    const url = await app.getUrl()
    const pid = process.pid
    const env = cluster.isPrimary
    const prefix = env ? 'P' : 'W'
    if (!isMainProcess) {
      return
    }

    if (isDev) {
      consola.debug(`[${prefix + pid}] OpenApi: ${url}/api-docs`)
    }
    consola.success(`[${prefix + pid}] Server listen on: ${url}`)
    consola.success(`[${prefix + pid}] Admin Dashboard: ${url}/qaqdmin`)
    consola.success(
      `[${prefix + pid}] Admin Local Dashboard: ${url}/proxy/qaqdmin`,
    )
    Logger.log(`Server is up. ${chalk.yellow(`+${performance.now() | 0}ms`)}`)
  })

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(() => app.close())
  }
}
