import { Module } from '@nestjs/common'
import { InitModule } from '../init/init.module'
import { PageProxyController } from './pageproxy.controller'

@Module({
  controllers: [PageProxyController],
  imports: [InitModule],
})
export class PageProxyModule {}
