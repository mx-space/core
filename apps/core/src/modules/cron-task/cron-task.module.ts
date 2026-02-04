import { forwardRef, Module } from '@nestjs/common'
import { AggregateModule } from '~/modules/aggregate/aggregate.module'
import { CronBusinessService } from './cron-business.service'
import { CronTaskController } from './cron-task.controller'
import { CronTaskScheduler } from './cron-task.scheduler'
import { CronTaskService } from './cron-task.service'

@Module({
  imports: [forwardRef(() => AggregateModule)],
  controllers: [CronTaskController],
  providers: [CronBusinessService, CronTaskService, CronTaskScheduler],
  exports: [CronTaskService, CronBusinessService],
})
export class CronTaskModule {}
