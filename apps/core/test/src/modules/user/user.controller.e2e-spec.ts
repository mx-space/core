import { createMockGlobalModule } from '@/helper/create-mock-global-module'
import { configProvider } from '@/mock/modules/config.mock'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { fastifyApp } from '~/common/adapters/fastify.adapter'
import { AuthService } from '~/modules/auth/auth.service'
import { AuthnService } from '~/modules/authn/authn.service'
import { UserController } from '~/modules/user/user.controller'
import { UserModel } from '~/modules/user/user.model'
import { UserService } from '~/modules/user/user.service'
import { getModelToken } from '~/transformers/model.transformer'
import { dbHelper } from 'test/helper/db-mock.helper'
import { redisHelper } from 'test/helper/redis-mock.helper'

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const { CacheService, token } = await redisHelper
    const moduleRef = await Test.createTestingModule({
      imports: [
        createMockGlobalModule([
          {
            provide: AuthnService,
            useValue: {},
          },
        ]),
      ],
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: getModelToken(UserModel.name),
          useValue: dbHelper.getModel(UserModel),
        },
        { provide: token, useValue: CacheService },
        configProvider,
        {
          provide: AuthService,
          useValue: {
            jwtServicePublic: {
              sign() {
                return 'fake token'
              },
            },
          },
        },
      ],
    }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(fastifyApp)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  it('POST /master/register', () => {
    return app
      .inject({
        method: 'POST',
        url: '/master/register',
        payload: {
          email: '11@example.com',
          username: '11',
          name: '11',
          password: '11',
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(201)
        const json = JSON.parse(res.payload)
        expect(json.username).toBe('11')
        expect(json.password).toBeUndefined()
      })
  })

  it('should throw if register again', () => {
    return app
      .inject({
        method: 'POST',
        url: '/master/register',
        payload: {
          username: '111',
          password: 'aaa',
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(400)
      })
  })

  it('GET /master/login', () => {
    return app
      .inject({
        method: 'POST',
        url: '/master/login',
        payload: {
          username: '11',
          password: '11',
        },
      })
      .then((res) => {
        expect(res.statusCode).toBe(200)
      })
  })
})
