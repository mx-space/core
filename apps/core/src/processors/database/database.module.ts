import { Global, Module } from '@nestjs/common'
import { databaseModels } from './database.models'
import { databaseProvider } from './database.provider'
import { DatabaseService } from './database.service'

@Module({
  providers: [DatabaseService, databaseProvider, ...databaseModels],
  exports: [DatabaseService, databaseProvider, ...databaseModels],
})
@Global()
export class DatabaseModule {}
