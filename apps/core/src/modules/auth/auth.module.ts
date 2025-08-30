import type {
  DynamicModule,
  MiddlewareConsumer,
  NestModule,
  Provider,
} from '@nestjs/common'
import { API_VERSION } from '~/app.config'
import { AuthInstanceInjectKey } from './auth.constant'
import { AuthController } from './auth.controller'
import type { AuthInstance } from './auth.interface'
import { AuthMiddleware } from './auth.middleware'
import { AuthService } from './auth.service'

export class AuthModule implements NestModule {
  static forRoot(): DynamicModule {
    let auth: AuthInstance

    const authProvider: Provider = {
      provide: AuthInstanceInjectKey,
      useValue: {
        get() {
          return auth
        },
        set(value: AuthInstance) {
          auth = value
        },
      },
    }

    return {
      controllers: [AuthController],
      exports: [AuthService, authProvider],
      module: AuthModule,
      global: true,

      providers: [AuthService, authProvider],
    }
  }

  configure(consumer: MiddlewareConsumer) {
    const basePath = isDev ? '/auth' : `/api/v${API_VERSION}/auth`

    consumer.apply(AuthMiddleware).forRoutes(`${basePath}/*auth`)
  }
}
