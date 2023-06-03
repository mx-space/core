import { Global, Module } from '@nestjs/common'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
@Global()
export class AuthModule {}
