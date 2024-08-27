import { merge } from 'lodash'

import {
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common'

import { authConfig } from './auth.config'
import { AuthConfigInjectKey } from './auth.constant'
import { AuthController } from './auth.controller'
import { ServerAuthConfig } from './auth.implement'
import { AuthMiddleware } from './auth.middleware'
import { AuthService } from './auth.service'

export class AuthModule implements NestModule {
  constructor(
    @Inject(AuthConfigInjectKey) private readonly config: ServerAuthConfig,
  ) {}
  static forRoot(config?: ServerAuthConfig): DynamicModule {
    const finalConfig = merge(authConfig, config)
    return {
      controllers: [AuthController],
      exports: [AuthService],
      module: AuthModule,
      global: true,

      providers: [
        AuthService,
        {
          provide: AuthConfigInjectKey,
          useValue: finalConfig,
        },
      ],
    }
  }

  configure(consumer: MiddlewareConsumer) {
    const config = this.config

    consumer
      .apply(AuthMiddleware)
      .forRoutes(`${config.basePath || '/auth'}/(.*)`)
  }
}
