import { Global, Module, forwardRef } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { AuthnModule } from '../authn/auth.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Global()
@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [AuthModule, forwardRef(() => AuthnModule)],
  exports: [UserService],
})
export class UserModule {}
