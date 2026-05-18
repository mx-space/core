import cluster from 'node:cluster'
import { performance } from 'node:perf_hooks'

import type { FastifyCorsOptions } from '@fastify/cors'
import { Logger } from '@innei/pretty-logger-nestjs'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import pc from 'picocolors'
import wcmatch from 'wildcard-match'

import { CROSS_DOMAIN, DEBUG_MODE, PORT, TELEMETRY } from './app.config'
import { AppModule } from './app.module'
import { fastifyApp } from './common/adapters/fastify.adapter'
import { RedisIoAdapter } from './common/adapters/socket.adapter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { extendedZodValidationPipeInstance } from './common/zod'
import { AppMigrationsService } from './database/app-migrations/app-migrations.service'
import { logger } from './global/consola.global'
import { isDev, isMainProcess, isTest } from './global/env.global'
import { RedisService } from './processors/redis/redis.service'
import { checkInit } from './utils/check-init.util'
import {
  sendTelemetry,
  startHeartbeat,
  stopHeartbeat,
} from './utils/telemetry.util'

const Origin: false | string[] = Array.isArray(CROSS_DOMAIN.allowedOrigins)
  ? [...CROSS_DOMAIN.allowedOrigins]
  : false

export async function bootstrap() {
  const isInit = await checkInit()

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(isInit),
    fastifyApp,
  )

  // 使用自定义 Logger 替换 NestJS 内置 Logger
  app.useLogger(app.get(Logger))

  const allowAllCors: FastifyCorsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          }
        : allowAllCors,
  )

  if (isDev || DEBUG_MODE.logging) {
    app.useGlobalInterceptors(new LoggingInterceptor())
  }

  app.useGlobalPipes(extendedZodValidationPipeInstance)
  !isTest &&
    app.useWebSocketAdapter(new RedisIoAdapter(app, app.get(RedisService)))

  // Dev runs app-data migrations inline; prod boots them via the standalone
  // `app-migrate.ts` CLI invoked by docker `mx-migrate`. Both paths share the
  // same `AppMigrationsService` and respect the advisory lock + ledger, so
  // multiple cluster workers / replicas hitting this concurrently is safe.
  if (isDev && !isTest) {
    await app.get(AppMigrationsService).run()
  }

  await app.listen(
    {
      host: '0.0.0.0',
      port: +PORT,
    },
    async () => {
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
      logger.info(`Server is up. ${pc.yellow(`+${performance.now() | 0}ms`)}`)

      if (TELEMETRY.enable) {
        logger.info(
          '[Telemetry] Anonymous telemetry is enabled. To disable, use --disable_telemetry or set MX_DISABLE_TELEMETRY=true',
        )
        sendTelemetry('startup')
        startHeartbeat()
      } else {
        logger.info('[Telemetry] Telemetry is disabled.')
      }

      // process.once: second Ctrl+C falls through to Node default for force-kill.
      const shutdown = async (signal: NodeJS.Signals) => {
        logger.info(`Received ${signal}, shutting down...`)
        if (TELEMETRY.enable) stopHeartbeat()
        try {
          await app.close()
        } catch (e) {
          logger.error('Error during shutdown:', e)
        }
        process.exit(0)
      }
      process.once('SIGINT', shutdown)
      process.once('SIGTERM', shutdown)
    },
  )
}
