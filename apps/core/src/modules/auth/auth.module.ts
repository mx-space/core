import type {
  DynamicModule,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common'
import type { CreateAuth } from './auth.implement'

import { API_VERSION } from '~/app.config'

import { AuthInstanceInjectKey } from './auth.constant'
import { AuthController } from './auth.controller'
import { AuthMiddleware } from './auth.middleware'
import { AuthService } from './auth.service'

export class AuthModule implements NestModule {
  static forRoot(): DynamicModule {
    let auth: ReturnType<typeof CreateAuth>['auth']
    return {
      controllers: [AuthController],
      exports: [AuthService],
      module: AuthModule,
      global: true,

      providers: [
        AuthService,
        {
          provide: AuthInstanceInjectKey,
          useValue: {
            get() {
              return auth
            },
            set(value: ReturnType<typeof CreateAuth>['auth']) {
              auth = value
            },
          },
        },
      ],
    }
  }

  configure(consumer: MiddlewareConsumer) {
    const basePath = isDev ? '/auth' : `/api/v${API_VERSION}/auth`

    consumer.apply(AuthMiddleware).forRoutes(`${basePath}/(.*)`)
  }
}
