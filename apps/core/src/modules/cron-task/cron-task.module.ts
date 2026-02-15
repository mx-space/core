import { forwardRef, Module } from '@nestjs/common'
import { AggregateModule } from '~/modules/aggregate/aggregate.module'
import { CronBusinessService } from './cron-business.service'
import {
  CronDefinitionController,
  CronTaskController,
} from './cron-task.controller'
import { CronTaskScheduler } from './cron-task.scheduler'
import { CronTaskService } from './cron-task.service'

@Module({
  imports: [forwardRef(() => AggregateModule)],
  controllers: [CronDefinitionController, CronTaskController],
  providers: [CronBusinessService, CronTaskService, CronTaskScheduler],
  exports: [CronTaskService, CronBusinessService],
})
export class CronTaskModule {}
