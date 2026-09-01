import { Module } from '@nestjs/common'

import { standardSchemaValidationPipeInstance } from '~/common/zod'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'

import { AckController } from './ack.controller'

@Module({
  controllers: [AckController],

  providers: [
    {
      provide: VALIDATION_PIPE_INJECTION,
      useValue: standardSchemaValidationPipeInstance,
    },
  ],
})
export class AckModule {}
