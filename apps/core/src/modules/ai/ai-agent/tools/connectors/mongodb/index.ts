import type { AgentTool } from '@mariozechner/pi-agent-core'
import type { AIAgentToolResult } from '../../../ai-agent.types'
import type {
  AIAgentToolConnector,
  AIAgentToolConnectorContext,
} from '../../connector.types'
import {
  executeMongoConfirmedAction,
  executeMongoTool,
  MongoToolParameters,
  type MongoToolArgs,
} from './executor'
import { mongoToolManifest } from './manifest'
import { mongoToolSystemPrompt } from './system-prompt'

type ExecuteMongoTool = (
  sessionId: string,
  seq: { value: number },
  params: MongoToolArgs,
) => Promise<AIAgentToolResult>

export function createMongoToolConnector(
  executeTool: ExecuteMongoTool,
): AIAgentToolConnector {
  return {
    manifest: mongoToolManifest,
    systemPrompt: mongoToolSystemPrompt,
    createTool: ({
      sessionId,
      seq,
    }: AIAgentToolConnectorContext): AgentTool<typeof MongoToolParameters> => {
      return {
        name: mongoToolManifest.name,
        label: mongoToolManifest.label,
        description: mongoToolManifest.description,
        parameters: MongoToolParameters,
        execute: async (_toolCallId, params) => {
          return executeTool(sessionId, seq, params)
        },
      }
    },
  }
}

export {
  executeMongoConfirmedAction,
  executeMongoTool,
  type MongoToolArgs,
  MongoToolParameters,
}
