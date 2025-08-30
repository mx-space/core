import { createRedisProvider } from '@/mock/modules/redis.mock'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { AppController } from '~/app.controller'
import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { OptionModel } from '~/modules/configs/configs.model'
import { CacheService } from '~/processors/redis/cache.service'
import { getModelToken } from '~/transformers/model.transformer'

describe('AppController (e2e)', async () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        CacheService,

        {
          provide: getModelToken(OptionModel.name),
          useValue: {},
        },
        await createRedisProvider(),
      ],
    })
      .overrideProvider(CacheService)
      .useValue({})
      .compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  test('GET /ping', () => {
    return app
      .inject({
        method: 'GET',
        url: '/ping',
      })
      .then((res) => {
        expect(res.statusCode).toBe(200)
        expect(res.payload).toBe('pong')
      })
  })

  test('GET /', () => {
    return app.inject({ url: '/' }).then((res) => {
      expect(res.statusCode).toBe(200)
      expect(res.payload).toBeDefined()
    })
  })

  test('GET /favicon.ico', () => {
    return app.inject({ url: '/favicon.ico' }).then((res) => {
      expect(res.payload).toBe('')
      expect(res.statusCode).toBe(204)
    })
  })

  describe('test security', () => {
    test('GET /admin', () => {
      return app.inject({ url: '/admin' }).then((res) => {
        expect(res.statusCode).toBe(200)
      })
    })

    test('GET /wp.php', () => {
      return app.inject({ url: '/wp.php' }).then((res) => {
        expect(res.statusCode).toBe(418)
      })
    })
    test('GET /1/1/11/1.php', () => {
      return app.inject({ url: '/1/1/11/1.php' }).then((res) => {
        expect(res.statusCode).toBe(418)
      })
    })
    test('GET /1/1/11/admin', () => {
      return app
        .inject({
          url: '/1/1/11/admin',
          headers: { 'user-agent': 'chrome mx-space/client' },
        })
        .then((res) => {
          expect(res.statusCode).toBe(666)
        })
    })

    test('GET /phpmyadmin', () => {
      return app.inject({ url: '/pages/slug/phpMyAdmin' }).then((res) => {
        expect(res.statusCode).toBe(200)
      })
    })
  })
})
