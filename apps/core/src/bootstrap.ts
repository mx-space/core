import cluster from 'node:cluster'
import { performance } from 'node:perf_hooks'
import wcmatch from 'wildcard-match'
import type { FastifyCorsOptions } from '@fastify/cors'
import type { LogLevel } from '@nestjs/common'
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

import { Logger } from '@innei/pretty-logger-nestjs'
import { NestFactory } from '@nestjs/core'

import { CROSS_DOMAIN, DEBUG_MODE, PORT } from './app.config'
import { AppModule } from './app.module'
import { fastifyApp } from './common/adapters/fastify.adapter'
import { RedisIoAdapter } from './common/adapters/socket.adapter'
import { SpiderGuard } from './common/guards/spider.guard'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { ExtendedValidationPipe } from './common/pipes/validation.pipe'
import { logger } from './global/consola.global'
import { isMainProcess, isTest } from './global/env.global'
import { checkInit } from './utils/check-init.util'

const Origin: false | string[] = Array.isArray(CROSS_DOMAIN.allowedOrigins)
  ? [...CROSS_DOMAIN.allowedOrigins, '*.shizuri.net', '22333322.xyz']
  : false

declare const module: any

export async function bootstrap() {
  const isInit = await checkInit()

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(isInit),
    fastifyApp,
    {
      logger: ['error'].concat(
        isDev || DEBUG_MODE.logging
          ? (['debug'] as any as LogLevel[])
          : ([] as LogLevel[]),
      ) as LogLevel[],
    },
  )

  const allowAllCors: FastifyCorsOptions = {
    credentials: true,
    origin: (origin, callback) => callback(null, origin || ''),
  }
  // Origin 如果不是数组就全部允许跨域

  app.enableCors(
    isDev
      ? allowAllCors
      : Origin
        ? {
            origin: (origin, callback) => {
              let currentHost: string
              try {
                currentHost = new URL(origin || '').host
              } catch {
                currentHost = origin || ''
              }
              const allow = Origin.some((host) => wcmatch(host)(currentHost))

              if (allow) {
                callback(null, origin || '')
              } else {
                callback(null, false)
              }
            },
            credentials: true,
            preflightContinue: false,
            optionsSuccessStatus: 204,
          }
        : allowAllCors,
  )

  if (isDev || DEBUG_MODE.logging) {
    app.useGlobalInterceptors(new LoggingInterceptor())
  }

  app.useGlobalPipes(ExtendedValidationPipe.shared)
  app.useGlobalGuards(new SpiderGuard())
  !isTest && app.useWebSocketAdapter(new RedisIoAdapter(app))

  await app.listen(
    {
      host: '0.0.0.0',
      port: +PORT,
    },
    async () => {
      app.useLogger(app.get(Logger))
      logger.info('ENV:', process.env.NODE_ENV)
      const url = await app.getUrl()
      const pid = process.pid
      const env = cluster.isPrimary
      const prefix = env ? 'P' : 'W'
      if (!isMainProcess) {
        return
      }

      logger.success(`[${prefix + pid}] Server listen on: ${url}`)
      logger.success(
        `[${prefix + pid}] Admin Local Dashboard: ${url}/proxy/qaqdmin`,
      )
      logger.info(
        `[${prefix + pid}] If you want to debug local dev dashboard on production environment with https domain, you can go to: https://<your-prod-domain>/proxy/qaqdmin/dev-proxy`,
      )
      logger.info(
        `[${prefix + pid}] If you want to debug local dev dashboard on dev environment with same site domain, you can go to: http://localhost:2333/proxy/qaqdmin/dev-proxy`,
      )
      logger.info(
        `Server is up. ${chalk.yellow(`+${performance.now() | 0}ms`)}`,
      )
    },
  )

  if (module.hot) {
    module.hot.accept()
    module.hot.dispose(() => app.close())
  }
}
