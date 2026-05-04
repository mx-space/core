import { Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { FileModule } from '../file/file.module'
import { LinkController, LinkControllerCrud } from './link.controller'
import { LinkRepository } from './link.repository'
import { LinkService } from './link.service'
import { LinkAvatarService } from './link-avatar.service'

@Module({
  controllers: [LinkController, LinkControllerCrud],
  providers: [LinkService, LinkAvatarService, LinkRepository],
  exports: [LinkService, LinkRepository],
  imports: [GatewayModule, FileModule],
})
export class LinkModule {}
