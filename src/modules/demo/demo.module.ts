import { resolve } from 'path'

import { Module } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { AssetService } from '~/processors/helper/helper.asset.service'

import { BackupModule } from '../backup/backup.module'
import { BackupService } from '../backup/backup.service'

@Module({
  imports: [BackupModule],
})
export class DemoModule {
  constructor(
    private readonly backupService: BackupService,
    private readonly assetService: AssetService,
  ) {
    this.reset()
  }
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  reset() {
    this.backupService.restore(
      resolve(this.assetService.embedAssetPath, 'demo-data.zip'),
    )
  }
}
