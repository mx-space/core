import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { hashSync } from 'bcrypt'
import { getModelToken } from 'nestjs-typegoose'
import { fastifyApp } from '~/common/adapt/fastify'
import { AuthService } from '~/modules/auth/auth.service'
import { UserController } from '~/modules/user/user.controller'
import { UserModel } from '~/modules/user/user.model'
import { UserService } from '~/modules/user/user.service'

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signToken() {
              return ''
            },
          },
        },
        {
          provide: UserService,
          useValue: {
            login() {
              return {
                username: 'test',
                avatar: '',
                email: 'tukon@gmail.com',
              }
            },
            recordFootstep() {
              return {}
            },
          },
        },
        {
          provide: getModelToken(UserModel.name),
          useValue: {
            findOne: jest.fn().mockImplementationOnce(() => ({
              select: jest.fn().mockResolvedValueOnce({
                username: 'test',
                password: hashSync('pwd', 2),
              }),
            })),
          },
        },
      ],
    }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('GET /master/login', () => {
    return app
      .inject({
        method: 'POST',
        url: '/master/login',
        payload: {
          username: 'test',
          password: 'pwd',
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(200)
      })
  })
})
