import { Module } from '@nestjs/common'
import { ExtendedValidationPipe } from '~/common/pipes/validation.pipe'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { AckController } from './ack.controller'

@Module({
  controllers: [AckController],

  providers: [
    {
      provide: VALIDATION_PIPE_INJECTION,
      useValue: ExtendedValidationPipe.shared,
    },
  ],
})
export class AckModule {}
