import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Controller, Get } from '@nestjs/common'

import { AIAgentService } from './ai-agent.service'

@Controller('ai/test')
export class TestController {
  constructor(private readonly aiAgentService: AIAgentService) {}

  @Get('/')
  async test() {
    return this.aiAgentService.runWithTools(
      'Posts Id: 65e99e28eb677674816310c7 主要了写了什么内容',
    )
  }

  @Get('/mcp')
  async mcp() {
    const client = new Client({
      name: 'streamable-http-client',
      version: '1.0.0',
    })
    const transport = new StreamableHTTPClientTransport(
      new URL('http://127.0.0.1:2333/mcp'),
    )
    await client.connect(transport)
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' },
    })
    return result
  }
}
