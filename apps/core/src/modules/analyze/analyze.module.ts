import { Module } from '@nestjs/common'

import { AnalyzeController } from './analyze.controller'
import { AnalyzeRepository } from './analyze.repository'
import { AnalyzeService } from './analyze.service'

@Module({
  controllers: [AnalyzeController],
  exports: [AnalyzeService],
  providers: [AnalyzeService, AnalyzeRepository],
})
export class AnalyzeModule {}
