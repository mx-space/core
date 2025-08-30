import { Module } from '@nestjs/common'
import { SlugTrackerService } from './slug-tracker.service'

@Module({
  providers: [SlugTrackerService],
  exports: [SlugTrackerService],
})
export class SlugTrackerModule {}
