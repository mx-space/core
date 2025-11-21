import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { FileModule } from '../file/file.module'
import { LinkAvatarService } from './link-avatar.service'
import { LinkController, LinkControllerCrud } from './link.controller'
import { LinkService } from './link.service'

@Module({
  controllers: [LinkController, LinkControllerCrud],
  providers: [LinkService, LinkAvatarService],
  exports: [LinkService],
  imports: [GatewayModule, FileModule],
})
export class LinkModule {}
