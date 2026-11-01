import { Module } from '@nestjs/common'

import { ContentUsageController } from './content-usage.controller'
import { ContentUsageRepository } from './content-usage.repository'

@Module({
  controllers: [ContentUsageController],
  providers: [ContentUsageRepository],
})
export class ContentUsageModule {}
