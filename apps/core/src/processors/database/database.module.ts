import { Global, Module } from '@nestjs/common'

import { SnowflakeService } from '~/shared/id/snowflake.service'

import { databaseModels } from './database.models'
import { databaseProvider } from './database.provider'
import { DatabaseService } from './database.service'
import { postgresProviders } from './postgres.provider'

@Module({
  providers: [
    DatabaseService,
    databaseProvider,
    ...databaseModels,
    ...postgresProviders,
    SnowflakeService,
  ],
  exports: [
    DatabaseService,
    databaseProvider,
    ...databaseModels,
    ...postgresProviders,
    SnowflakeService,
  ],
})
@Global()
export class DatabaseModule {}
