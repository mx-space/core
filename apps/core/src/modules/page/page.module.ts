import { Module } from '@nestjs/common'

import { GatewayModule } from '~/processors/gateway/gateway.module'

import { DraftModule } from '../draft/draft.module'
import { PageController } from './page.controller'
import { PageRepository } from './page.repository'
import { PageService } from './page.service'

@Module({
  imports: [GatewayModule, DraftModule],
  controllers: [PageController],
  providers: [PageService, PageRepository],
  exports: [PageService, PageRepository],
})
export class PageModule {}
