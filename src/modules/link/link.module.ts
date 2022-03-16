import { Module } from '@nestjs/common'
import { LinkController, LinkControllerCrud } from './link.controller'
import { LinkService } from './link.service'
import { GatewayModule } from '~/processors/gateway/gateway.module'

@Module({
  controllers: [LinkController, LinkControllerCrud],
  providers: [LinkService],
  exports: [LinkService],
  imports: [GatewayModule],
})
export class LinkModule {}
