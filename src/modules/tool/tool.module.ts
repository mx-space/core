import { Global, Module } from '@nestjs/common'

import { ToolController } from './tool.controller'
import { ToolService } from './tool.service'

@Global()
@Module({
  providers: [ToolService],
  controllers: [ToolController],
  exports: [ToolService],
})
export class ToolModule {}
