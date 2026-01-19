import { Global, Module } from '@nestjs/common'
import { extendedZodValidationPipeInstance } from '~/common/zod'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { UserModule } from '../user/user.module'
import { ConfigsService } from './configs.service'

@Global()
@Module({
  providers: [
    ConfigsService,
    {
      provide: VALIDATION_PIPE_INJECTION,
      useValue: extendedZodValidationPipeInstance,
    },
  ],
  imports: [UserModule],
  exports: [ConfigsService],
})
export class ConfigsModule {}
