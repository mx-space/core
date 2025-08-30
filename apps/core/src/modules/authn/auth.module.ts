import { Global, Module } from '@nestjs/common'
import { AuthnController } from '../authn/authn.controller'
import { AuthnService } from './authn.service'

@Module({
  providers: [AuthnService],
  controllers: [AuthnController],
  exports: [AuthnService],
})
@Global()
export class AuthnModule {}
