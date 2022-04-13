import {
  Controller,
  Get,
  MiddlewareConsumer,
  Module,
  NestModule,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'

import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { RolesGuard } from '~/common/guard/roles.guard'
import { AttachHeaderTokenMiddleware } from '~/common/middlewares/attach-auth.middleware'

@Controller('/')
@UseGuards(RolesGuard)
class TestContoller {
  @Get('/')
  get(@Req() req: any) {
    return req.headers.authorization
  }
}
@Module({ controllers: [TestContoller] })
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AttachHeaderTokenMiddleware).forRoutes('(.*)')
  }
}
describe('AuthMiddleware (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthGuard)
      .useValue({ canActivate: () => true, verifyCustomToken: () => false })
      .compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('get / ', async () => {
    const token = 'fake token'
    app
      .inject({
        method: 'GET',
        url: `/?token=Bearer ${token}`,
      })
      .then(async (res) => {
        expect(res.statusCode).toBe(200)
        expect(res.body).toBe(`Bearer ${token}`)
      })
  })
})
