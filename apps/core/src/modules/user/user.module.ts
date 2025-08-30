import { forwardRef, Global, Module } from '@nestjs/common'
import { AuthnModule } from '../authn/auth.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Global()
@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [forwardRef(() => AuthnModule)],
  exports: [UserService],
})
export class UserModule {}
