import { forwardRef, Module } from '@nestjs/common'

import { AggregateModule } from '~/modules/aggregate/aggregate.module'
import { AiModule } from '~/modules/ai/ai.module'
import { AnalyzeModule } from '~/modules/analyze/analyze.module'
import { SearchModule } from '~/modules/search/search.module'

import { CronBusinessService } from './cron-business.service'
import { CronDefinitionController } from './cron-task.controller'
import { CronTaskScheduler } from './cron-task.scheduler'
import { CronTaskService } from './cron-task.service'

@Module({
  imports: [
    forwardRef(() => AggregateModule),
    AnalyzeModule,
    SearchModule,
    AiModule,
  ],
  controllers: [CronDefinitionController],
  providers: [CronBusinessService, CronTaskService, CronTaskScheduler],
  exports: [CronTaskService, CronBusinessService],
})
export class CronTaskModule {}
