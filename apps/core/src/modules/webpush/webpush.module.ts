import { Module } from '@nestjs/common'

import { WebpushController } from './webpush.controller'
import { WebpushService } from './webpush.service'

@Module({
  controllers: [WebpushController],
  providers: [WebpushService],
})
export class WebPushModule {}
