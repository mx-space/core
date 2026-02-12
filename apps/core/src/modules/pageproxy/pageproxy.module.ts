import { Module } from '@nestjs/common'
import { OwnerModule } from '../owner/owner.module'
import { UpdateModule } from '../update/update.module'
import { AdminDownloadManager } from './admin-download.manager'
import { PageProxyController } from './pageproxy.controller'
import { PageProxyService } from './pageproxy.service'

@Module({
  controllers: [PageProxyController],
  providers: [PageProxyService, AdminDownloadManager],
  imports: [UpdateModule, OwnerModule],
})
export class PageProxyModule {}
