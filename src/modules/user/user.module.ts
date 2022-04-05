import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [AuthModule],
  exports: [UserService],
})
export class UserModule {}
