import { Module } from '@nestjs/common'
import { UserModule } from '../user/user.module'
import { InitController } from './init.controller'
import { InitService } from './init.service'

@Module({
  providers: [InitService],
  exports: [InitService],
  controllers: [InitController],
  imports: [UserModule],
})
export class InitModule {}
