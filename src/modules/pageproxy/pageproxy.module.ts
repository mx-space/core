import { Module } from '@nestjs/common'

import { PageProxyController } from './pageproxy.controller'
import { PageProxyService } from './pageproxy.service'

@Module({
  controllers: [PageProxyController],
  providers: [PageProxyService],
})
export class PageProxyModule {}
