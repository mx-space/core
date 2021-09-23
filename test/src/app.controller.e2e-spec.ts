import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { getModelToken } from 'nestjs-typegoose'
import { AppController } from '~/app.controller'
import { fastifyApp } from '~/common/adapt/fastify'
import { OptionModel } from '~/modules/configs/configs.model'
import { CacheService } from '~/processors/cache/cache.service'
describe('AppController (e2e)', () => {
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
      ],
    })
      .overrideProvider(CacheService)
      .useValue({})

      .compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('GET /ping', () => {
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

  it('GET /', () => {
    return app.inject({ url: '/' }).then((res) => {
      expect(res.statusCode).toBe(200)
      expect(res.payload).toBeDefined()
    })
  })
})
