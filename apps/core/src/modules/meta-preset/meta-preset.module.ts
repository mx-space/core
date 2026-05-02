import { Module } from '@nestjs/common'

import { MetaPresetController } from './meta-preset.controller'
import { MetaPresetRepository } from './meta-preset.repository'
import { MetaPresetService } from './meta-preset.service'

@Module({
  providers: [MetaPresetService, MetaPresetRepository],
  exports: [MetaPresetService, MetaPresetRepository],
  controllers: [MetaPresetController],
})
export class MetaPresetModule {}
