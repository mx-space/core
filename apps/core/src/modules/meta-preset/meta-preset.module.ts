import { Module } from '@nestjs/common'
import { MetaPresetController } from './meta-preset.controller'
import { MetaPresetService } from './meta-preset.service'

@Module({
  providers: [MetaPresetService],
  exports: [MetaPresetService],
  controllers: [MetaPresetController],
})
export class MetaPresetModule {}
