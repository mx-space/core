import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { LinkController } from './link.controller'
import { LinkService } from './link.service'

@Module({
  controllers: [LinkController],
  providers: [LinkService],
  exports: [LinkService],
  imports: [GatewayModule],
})
export class LinkModule {}
