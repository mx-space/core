import { Module } from '@nestjs/common'

import { UpdateModule } from '../update/update.module'
import { PageProxyController } from './pageproxy.controller'
import { PageProxyService } from './pageproxy.service'

@Module({
  controllers: [PageProxyController],
  providers: [PageProxyService],
  imports: [UpdateModule],
})
export class PageProxyModule {}
