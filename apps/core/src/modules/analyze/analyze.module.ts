import { Module } from '@nestjs/common'

import { ConfigsModule } from '../configs/configs.module'
import { AnalyzeController } from './analyze.controller'
import { AnalyzeRepository } from './analyze.repository'
import { AnalyzeService } from './analyze.service'
import { AnalyzeSampleService } from './sample/analyze-sample.service'

@Module({
  imports: [ConfigsModule],
  controllers: [AnalyzeController],
  exports: [AnalyzeService, AnalyzeRepository],
  providers: [AnalyzeService, AnalyzeRepository, AnalyzeSampleService],
})
export class AnalyzeModule {}
