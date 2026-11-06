import type { AgentStore } from '@haklex/rich-agent-core'
import type { WsClient } from '@mx-space/ws-client'

import type { AgentRuntime } from '~/vendor/rich-editor/types'
import type { DocumentBashWorkspace } from '~/vendor/rich-editor/utils/document-bash'

import { createAgentWireClient } from './agent-wire-client'
import { createServerAgentRunner } from './server-agent-runner'
import type { SelectedAgentModel } from './types'

export interface WriteAgentRuntimeOptions {
  getConversationId: () => string | null
  onConversation: (conversationId: string) => void
  onReviewBatch?: (batchId: string, toolCallId: string) => void
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
  const wire = createAgentWireClient()
  let watched: { socket: WsClient; dispose: () => void } | null = null

  const watch = (socket: WsClient) => {
    if (watched?.socket === socket) return
    watched?.dispose()
    wire.reset()
    watched = {
      dispose: socket.on('$state', (state: string) => {
        if (state !== 'open') wire.reset()
      }),
      socket,
    }
  }

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
      watch(socket)
      const runner = createServerAgentRunner({
        connectionLostMessage: options.connectionLostMessage,
        collectFiles: (name) =>
          name === options.workspace.tool.name
            ? options.workspace.touchedFiles()
            : [],
        onConversation: options.onConversation,
        onOperationsChanged: (operations, toolCallId) => {
          const before = new Set(
            options.store.getState().reviewState?.batches.map((b) => b.id),
          )
          onOperationsChanged(operations, toolCallId)
          for (const batch of options.store.getState().reviewState?.batches ??
            []) {
            if (!before.has(batch.id)) {
              options.onReviewBatch?.(batch.id, toolCallId)
            }
          }
        },
        socket,
        store: options.store,
        tools,
        wire,
      })
      active = runner
      const done = await runner
        .run(
          {
            conversationId: options.getConversationId(),
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
