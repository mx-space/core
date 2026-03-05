import { Injectable } from '@nestjs/common'
import type { Db } from 'mongodb'

import type { AIAgentToolId, AIAgentToolResult } from '../ai-agent.types'
import type { AIAgentToolConnector } from '../tools/connector.types'
import {
  createConnectorRegistry,
  normalizeEnabledToolIds,
  resolveEnabledConnectors,
} from '../tools/connector-registry'
import {
  createMongoToolConnector,
  executeMongoTool,
  type MongoToolArgs,
} from '../tools/connectors/mongodb'
import {
  createShellToolConnector,
  executeShellTool,
  type ShellToolArgs,
} from '../tools/connectors/shell'

interface BuildConnectorsInput {
  db: Db
  safeJson: (input: unknown) => string
  createPendingAction: (
    sessionId: string,
    seq: { value: number },
    toolName: string,
    args: Record<string, unknown>,
    dryRunPreview: Record<string, unknown>,
  ) => Promise<{ id: string }>
}

@Injectable()
export class AIAgentToolsEngineService {
  buildRegistry(input: BuildConnectorsInput) {
    return createConnectorRegistry(this.buildConnectors(input))
  }

  resolveEnabled(
    enabledTools: readonly AIAgentToolId[],
    input: BuildConnectorsInput,
  ) {
    const registry = this.buildRegistry(input)
    const normalized = normalizeEnabledToolIds(enabledTools, registry)
    return resolveEnabledConnectors(normalized, registry)
  }

  private buildConnectors(input: BuildConnectorsInput): AIAgentToolConnector[] {
    return [
      createMongoToolConnector(async (sessionId, seq, params) => {
        return this.executeMongo(input, sessionId, seq, params)
      }),
      createShellToolConnector(async (sessionId, seq, params) => {
        return this.executeShell(input, sessionId, seq, params)
      }),
    ]
  }

  private async executeMongo(
    input: BuildConnectorsInput,
    sessionId: string,
    seq: { value: number },
    params: MongoToolArgs,
  ): Promise<AIAgentToolResult> {
    return executeMongoTool({
      db: input.db,
      sessionId,
      seq,
      params,
      safeJson: input.safeJson,
      createPendingAction: input.createPendingAction,
    })
  }

  private async executeShell(
    input: BuildConnectorsInput,
    sessionId: string,
    seq: { value: number },
    params: ShellToolArgs,
  ): Promise<AIAgentToolResult> {
    return executeShellTool({
      sessionId,
      seq,
      params,
      safeJson: input.safeJson,
      createPendingAction: input.createPendingAction,
    })
  }
}
