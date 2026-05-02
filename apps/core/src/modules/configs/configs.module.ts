import { Global, Module } from '@nestjs/common'

import { extendedZodValidationPipeInstance } from '~/common/zod'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'

import { OwnerModule } from '../owner/owner.module'
import { ConfigsService } from './configs.service'
import { OptionsRepository } from './options.repository'

@Global()
@Module({
  providers: [
    ConfigsService,
    OptionsRepository,
    {
      provide: VALIDATION_PIPE_INJECTION,
      useValue: extendedZodValidationPipeInstance,
    },
  ],
  imports: [OwnerModule],
  exports: [ConfigsService, OptionsRepository],
})
export class ConfigsModule {}
