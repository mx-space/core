import type { MiddlewareConsumer, NestModule } from '@nestjs/common'

import { Module, RequestMethod } from '@nestjs/common'

import { ServerTimeController } from './server-time.controller'
import { trackResponseTimeMiddleware } from './server-time.middleware'

@Module({
  controllers: [ServerTimeController],
})
export class ServerTimeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(trackResponseTimeMiddleware)
      .forRoutes({ path: '/server-time', method: RequestMethod.ALL })
  }
}
