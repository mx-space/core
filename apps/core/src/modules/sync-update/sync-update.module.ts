import { Module } from '@nestjs/common'
import { SyncUpdateService } from './sync-update.service'

@Module({
  providers: [SyncUpdateService],
  exports: [SyncUpdateService],
})
export class SyncUpdateModule {}
