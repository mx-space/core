import { forwardRef, Module } from '@nestjs/common'

import { McpModule } from '../../mcp/mcp.module'
import { AiModule } from '../ai.module'
import { AiMcpFunctionService } from './ai-mcp-function.service'
import { AiToolService } from './ai-tool.service'

@Module({
  imports: [McpModule, forwardRef(() => AiModule)],
  providers: [AiToolService, AiMcpFunctionService],

  exports: [AiToolService, AiMcpFunctionService],
})
export class AiToolModule {}
