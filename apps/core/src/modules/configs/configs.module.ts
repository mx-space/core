import { Global, Module } from '@nestjs/common'
import { ExtendedValidationPipe } from '~/common/pipes/validation.pipe'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { UserModule } from '../user/user.module'
import { ConfigsService } from './configs.service'

@Global()
@Module({
  providers: [
    ConfigsService,
    {
      provide: VALIDATION_PIPE_INJECTION,
      useValue: ExtendedValidationPipe.shared,
    },
  ],
  imports: [UserModule],
  exports: [ConfigsService],
})
export class ConfigsModule {}
