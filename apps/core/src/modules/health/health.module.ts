import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthCronController } from './sub-controller/cron.controller'
import { HealthLogController } from './sub-controller/log.controller'

@Module({
  controllers: [HealthController, HealthCronController, HealthLogController],
})
export class HealthModule {}
