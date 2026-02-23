import { Module } from '@nestjs/common'
import { UpdateDownloadService } from './update-download.service'
import { UpdateInstallService } from './update-install.service'
import { UpdateController } from './update.controller'
import { UpdateService } from './update.service'

@Module({
  controllers: [UpdateController],
  providers: [UpdateService, UpdateDownloadService, UpdateInstallService],
  exports: [UpdateService],
})
export class UpdateModule {}
