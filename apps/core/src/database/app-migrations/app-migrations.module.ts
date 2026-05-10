import { Module } from '@nestjs/common'

import { AppMigrationsService } from './app-migrations.service'

@Module({
  providers: [AppMigrationsService],
  exports: [AppMigrationsService],
})
export class AppMigrationsModule {}
