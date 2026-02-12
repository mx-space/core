import { Module } from '@nestjs/common'
import { BackupModule } from '../backup/backup.module'
import { OptionModule } from '../option/option.module'
import { OwnerModule } from '../owner/owner.module'
import { InitController } from './init.controller'
import { InitService } from './init.service'

@Module({
  providers: [InitService],
  exports: [InitService],
  controllers: [InitController],
  imports: [OwnerModule, OptionModule, BackupModule],
})
export class InitModule {}
