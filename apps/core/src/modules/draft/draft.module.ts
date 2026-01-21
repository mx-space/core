import { Module } from '@nestjs/common'
import { DRAFT_SERVICE_TOKEN } from '~/constants/injection.constant'
import { DraftController } from './draft.controller'
import { DraftService } from './draft.service'

@Module({
  controllers: [DraftController],
  providers: [
    DraftService,
    { provide: DRAFT_SERVICE_TOKEN, useExisting: DraftService },
  ],
  exports: [DraftService, DRAFT_SERVICE_TOKEN],
})
export class DraftModule {}
