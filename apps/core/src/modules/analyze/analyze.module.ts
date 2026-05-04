import { Module } from '@nestjs/common'

import { ConfigsModule } from '../configs/configs.module'
import { AnalyzeController } from './analyze.controller'
import { AnalyzeRepository } from './analyze.repository'
import { AnalyzeService } from './analyze.service'

@Module({
  imports: [ConfigsModule],
  controllers: [AnalyzeController],
  exports: [AnalyzeService, AnalyzeRepository],
  providers: [AnalyzeService, AnalyzeRepository],
})
export class AnalyzeModule {}
