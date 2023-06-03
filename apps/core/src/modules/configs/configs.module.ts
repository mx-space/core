import { Global, Module } from '@nestjs/common'

import { UserModule } from '../user/user.module'
import { ConfigsService } from './configs.service'

@Global()
@Module({
  providers: [ConfigsService],
  imports: [UserModule],
  exports: [ConfigsService],
})
export class ConfigsModule {}
