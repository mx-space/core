import { Module } from '@nestjs/common'

import { SlugTrackerRepository } from './slug-tracker.repository'
import { SlugTrackerService } from './slug-tracker.service'

@Module({
  providers: [SlugTrackerService, SlugTrackerRepository],
  exports: [SlugTrackerService],
})
export class SlugTrackerModule {}
