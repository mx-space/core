import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { LinkController, LinkControllerCrud } from './link.controller'
import { LinkService } from './link.service'

@Module({
  controllers: [LinkController, LinkControllerCrud],
  providers: [LinkService],
  exports: [LinkService],
  imports: [GatewayModule],
})
export class LinkModule {}
