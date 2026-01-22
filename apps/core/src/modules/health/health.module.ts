import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthCronController } from './sub-controller/cron.controller'

@Module({
  controllers: [HealthController, HealthCronController],
})
export class HealthModule {}
