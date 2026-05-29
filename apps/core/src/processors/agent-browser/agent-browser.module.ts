import { Global, Module } from '@nestjs/common'

import { AgentBrowserService } from './agent-browser.service'
import { AgentBrowserSessionPool } from './agent-browser-pool.service'

@Global()
@Module({
  providers: [AgentBrowserSessionPool, AgentBrowserService],
  exports: [AgentBrowserSessionPool, AgentBrowserService],
})
export class AgentBrowserModule {}
