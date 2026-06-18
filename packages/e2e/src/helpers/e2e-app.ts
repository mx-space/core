import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { Pool } from 'pg'
import { createIsolatedPgDatabase } from 'test/helper/pg-testcontainer'

import {
  type RedisTestContainer,
  startRedisTestContainer,
} from './redis-container'

const migrationsDir = new URL(
  '../../../../apps/core/src/database/migrations',
  import.meta.url,
).pathname

export interface E2EBackend {
  port: number
  siteUrl: string
  apiBase: string
  app: NestFastifyApplication
  authApi: Record<string, any>
  pgUri: string
  redisUri: string
  pgPool: Pool
  stop: () => Promise<void>
}

export async function createE2EBackend(): Promise<E2EBackend> {
  const pg = await createIsolatedPgDatabase()
  const redis = await startRedisTestContainer()

  const pgUri = pg.getConnectionUri()
  seedProcessEnv(pgUri, redis)

  const [
    { initializeApp },
    { Test },
    { AppModule },
    { fastifyApp },
    pipes,
    pgProvider,
    constants,
    authConstant,
    redisModule,
  ] = await Promise.all([
    import('~/global/index.global'),
    import('@nestjs/testing'),
    import('~/app.module'),
    import('~/common/adapters/fastify.adapter'),
    import('~/common/zod'),
    import('~/processors/database/postgres.provider'),
    import('~/constants/system.constant'),
    import('~/modules/auth/auth.constant'),
    import('~/processors/redis/redis.service'),
  ])

  initializeApp()

  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app =
    testingModule.createNestApplication<NestFastifyApplication>(fastifyApp)
  const { requestCaseNormalizationPipeInstance } =
    await import('~/common/pipes/case-normalization.pipe')
  app.useGlobalPipes(
    requestCaseNormalizationPipeInstance,
    pipes.extendedZodValidationPipeInstance,
  )

  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  await app.listen(0, '127.0.0.1')

  const address = app.getHttpServer().address()
  if (!address || typeof address === 'string') {
    throw new Error('failed to resolve e2e backend listen port')
  }

  const siteUrl = `http://127.0.0.1:${address.port}`
  const apiBase = `${siteUrl}/api/v3`
  const authHolder = app.get(authConstant.AuthInstanceInjectKey)
  const pgPool = app.get<Pool>(constants.PG_POOL_TOKEN)

  return {
    port: address.port,
    siteUrl,
    apiBase,
    app,
    authApi: authHolder.get().api,
    pgUri,
    redisUri: redis.uri,
    pgPool,
    async stop() {
      try {
        const redisService = app.get(redisModule.RedisService, {
          strict: false,
        })
        redisService.getClient().disconnect()
      } catch {}

      await app.close()
      await pgProvider.disposePool()
      await pg.drop()
      await redis.stop()
    },
  }
}

function seedProcessEnv(pgUri: string, redis: RedisTestContainer) {
  process.env.PG_URL = pgUri
  process.env.PG_CONNECTION_STRING = pgUri
  process.env.PG_VERIFY_URL = pgUri
  process.env.POSTGRES_URL = pgUri
  process.env.REDIS_CONNECTION_STRING = redis.uri
  process.env.REDIS_HOST = redis.host
  process.env.REDIS_PORT = String(redis.port)
  process.env.MIGRATIONS_DIR = migrationsDir
  process.env.JWT_SECRET ??= 'e2e-jwt-secret-e2e-jwt-secret-123456'
  process.env.SNOWFLAKE_WORKER_ID ??= '1'
}
