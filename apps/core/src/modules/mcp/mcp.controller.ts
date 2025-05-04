import { FastifyReply } from 'fastify'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from '@mx-space/compiled/zod'
import {
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { FastifyBizRequest } from '~/transformers/get-req.transformer'

import { McpService } from './mcp.service'

@ApiController({ path: 'mcp' })
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  private setupServer() {
    const server = new Server({
      name: 'Mix Space MCP Server',
      version: '1.0.0',
    })
    server.setRequestHandler(
      z.object({ message: z.string(), method: z.literal('echo') }),
      async ({ message }) => {
        return {
          content: [{ type: 'text', text: `Tool echo: ${message}` }],
          tools: [
            {
              name: 'echo',
              description: 'Echo a message',
              parameters: z.object({ message: z.string() }),
              inputSchema: z.object({ message: z.string() }),
            },
          ],
        }
      },
    )

    return server
  }
  @Post('/')
  async handle(@Req() req: FastifyBizRequest, @Res() res: FastifyReply) {
    try {
      const server = this.setupServer()
      const transport: StreamableHTTPServerTransport =
        new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        })
      res.raw.on('close', () => {
        transport.close()
        server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req.raw, res.raw, req.body)
    } catch (error) {
      console.error('Error handling MCP request:', error)
      if (!res.raw.headersSent) {
        res.status(500).send({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        })
      }
    }
  }
}
