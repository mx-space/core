import { Module } from '@nestjs/common'
import { PageController } from './page.controller'
import { PageService } from './page.service'
import { GatewayModule } from '~/processors/gateway/gateway.module'

@Module({
  imports: [GatewayModule],
  controllers: [PageController],
  providers: [PageService],
  exports: [PageService],
})
export class PageModule {}
