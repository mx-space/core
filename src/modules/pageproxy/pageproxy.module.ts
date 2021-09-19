import { Module } from '@nestjs/common'
import { PageProxyController } from './pageproxy.controller'

@Module({
  controllers: [PageProxyController],
})
export class PageProxyModule {}
