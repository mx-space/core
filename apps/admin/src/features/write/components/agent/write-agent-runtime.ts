import type { AgentStore } from '@haklex/rich-agent-core'
import type { WsClient } from '@mx-space/ws-client'

import type { AgentRuntime } from '~/vendor/rich-editor/types'
import type { DocumentBashWorkspace } from '~/vendor/rich-editor/utils/document-bash'

import { createServerAgentRunner } from './server-agent-runner'
import type { SelectedAgentModel } from './types'

export interface WriteAgentRuntimeOptions {
  ensureConversation: () => Promise<string | null>
  getSocket: () => WsClient | null
  model: SelectedAgentModel
  sessionId: string
  store: AgentStore
  workspace: DocumentBashWorkspace
  socketUnavailableMessage: string
  connectionLostMessage: string
}

export function createWriteAgentRuntime(
  options: WriteAgentRuntimeOptions,
): AgentRuntime {
  let active: ReturnType<typeof createServerAgentRunner> | null = null

  return {
    steer: async (userInput) =>
      active
        ? active.steer(userInput, options.workspace.snapshotFiles())
        : false,
    run: async ({
      onOperationsChanged,
      signal,
      systemMessages,
      tools,
      userInput,
    }) => {
      const socket = options.getSocket()
      if (!socket || socket.state !== 'open') {
        throw new Error(options.socketUnavailableMessage)
      }
      const conversationId = await options.ensureConversation()
      const runner = createServerAgentRunner({
        connectionLostMessage: options.connectionLostMessage,
        collectFiles: (name) =>
          name === options.workspace.tool.name
            ? options.workspace.touchedFiles()
            : [],
        onOperationsChanged,
        socket,
        store: options.store,
        tools,
      })
      active = runner
      const done = await runner
        .run(
          {
            conversationId,
            files: options.workspace.snapshotFiles(),
            model: options.model.modelId,
            providerId: options.model.providerId,
            sessionId: options.sessionId,
            system: systemMessages,
            user: userInput,
          },
          signal,
        )
        .finally(() => {
          if (active === runner) active = null
        })
      if (done.status === 'failed') {
        throw new Error(done.error ?? 'Agent run failed')
      }
    },
  }
}
