import type { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { Module, RequestMethod } from '@nestjs/common'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { ServerTimeController } from './server-time.controller'
import { trackResponseTimeMiddleware } from './server-time.middleware'

@Module({
  controllers: [ServerTimeController],
})
export class ServerTimeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(trackResponseTimeMiddleware).forRoutes({
      path: isDev ? '/server-time' : `${apiRoutePrefix}/server-time`,
      method: RequestMethod.ALL,
    })
  }
}
