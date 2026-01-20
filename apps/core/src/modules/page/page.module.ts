import { Module } from '@nestjs/common'
import { GatewayModule } from '~/processors/gateway/gateway.module'
import { DraftModule } from '../draft/draft.module'
import { PageController } from './page.controller'
import { PageService } from './page.service'

@Module({
  imports: [GatewayModule, DraftModule],
  controllers: [PageController],
  providers: [PageService],
  exports: [PageService],
})
export class PageModule {}
