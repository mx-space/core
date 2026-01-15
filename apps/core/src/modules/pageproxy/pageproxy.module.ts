import { Module } from '@nestjs/common'
import { UpdateModule } from '../update/update.module'
import { UserModule } from '../user/user.module'
import { AdminDownloadManager } from './admin-download.manager'
import { PageProxyController } from './pageproxy.controller'
import { PageProxyService } from './pageproxy.service'

@Module({
  controllers: [PageProxyController],
  providers: [PageProxyService, AdminDownloadManager],
  imports: [UpdateModule, UserModule],
})
export class PageProxyModule {}
