import { Module } from '@nestjs/common'

import { OptionModule } from '../option/option.module'
import { UserModule } from '../user/user.module'
import { InitController } from './init.controller'
import { InitService } from './init.service'

@Module({
  providers: [InitService],
  exports: [InitService],
  controllers: [InitController],
  imports: [UserModule, OptionModule],
})
export class InitModule {}
