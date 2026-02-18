import type { AgentTool } from '@mariozechner/pi-agent-core'
import type { AIAgentToolResult } from '../../../ai-agent.types'
import type {
  AIAgentToolConnector,
  AIAgentToolConnectorContext,
} from '../../connector.types'
import {
  executeShellCommand,
  executeShellConfirmedAction,
  executeShellTool,
  ShellToolParameters,
  type ShellToolArgs,
} from './executor'
import { shellToolManifest } from './manifest'
import { shellToolSystemPrompt } from './system-prompt'

type ExecuteShellTool = (
  sessionId: string,
  seq: { value: number },
  params: ShellToolArgs,
) => Promise<AIAgentToolResult>

export function createShellToolConnector(
  executeTool: ExecuteShellTool,
): AIAgentToolConnector {
  return {
    manifest: shellToolManifest,
    systemPrompt: shellToolSystemPrompt,
    createTool: ({
      sessionId,
      seq,
    }: AIAgentToolConnectorContext): AgentTool<typeof ShellToolParameters> => {
      return {
        name: shellToolManifest.name,
        label: shellToolManifest.label,
        description: shellToolManifest.description,
        parameters: ShellToolParameters,
        execute: async (_toolCallId, params) => {
          return executeTool(sessionId, seq, params)
        },
      }
    },
  }
}

export {
  executeShellCommand,
  executeShellConfirmedAction,
  executeShellTool,
  type ShellToolArgs,
  ShellToolParameters,
}
