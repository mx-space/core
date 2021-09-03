import { Global, Module } from '@nestjs/common'
import { ConfigsService } from './configs.service'

@Global()
@Module({
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
