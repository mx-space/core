import { Module } from '@nestjs/common'
import { InitModule } from '../init/init.module'
import { PageProxyController } from './pageproxy.controller'
import { PageProxyService } from './pageproxy.service'

@Module({
  controllers: [PageProxyController],
  providers: [PageProxyService],
  imports: [InitModule],
})
export class PageProxyModule {}
