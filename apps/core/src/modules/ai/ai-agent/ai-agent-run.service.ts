import type {
  AssistantMessage,
  Message as PiMessage,
  ToolCall,
  ToolResultMessage,
} from '@earendil-works/pi-ai'
import type {
  AgentFileSnapshot,
  AgentRunPayload,
  AgentRunStatus,
  AgentServerEvent,
  AgentToolResultPayload,
  AgentToolSchema,
} from '@mx-space/ai'
import {
  convertJsonSchemaToTypeBox,
  createModelRuntime,
} from '@mx-space/ai/runtime'
import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'

import { AiAgentArticleSource } from './ai-agent-article.source'
import { AiAgentConversationRepository } from './ai-agent-conversation.repository'
import {
  bubblesToHistory,
  mapPiEventToSse,
  toPiMessages,
} from './ai-agent-messages'
import {
  type AgentArticleSource,
  type AgentServerTool,
  createAgentServerTools,
} from './ai-agent-server-tools'
import { type AgentSteerInbox, createSteerInbox } from './ai-agent-steer'
import { type KnownFiles, reconcileFiles, recordFiles } from './ai-agent-vfs'

const MAX_MODEL_CALLS = 40

export interface AgentTranscript {
  messages: PiMessage[]
  known: KnownFiles
}

export interface AgentRunSink {
  emit: (event: AgentServerEvent) => void
  callClientTool: (call: {
    toolCallId: string
    name: string
    arguments: Record<string, unknown>
  }) => Promise<Omit<AgentToolResultPayload, 'runId'>>
}

export interface AgentRunOptions {
  sink: AgentRunSink
  signal: AbortSignal
  memory: Map<string, AgentTranscript>
  inbox?: AgentSteerInbox
}

export interface AgentRunResult {
  status: AgentRunStatus
  error?: string
}

interface TranscriptHandle {
  transcript: AgentTranscript
  save: () => Promise<void>
}

@Injectable()
export class AiAgentRunService {
  private readonly logger = new Logger(AiAgentRunService.name)
  private readonly serverTools: AgentServerTool[]

  constructor(
    private readonly configService: ConfigsService,
    private readonly conversationRepository: AiAgentConversationRepository,
    articleSource: AiAgentArticleSource,
  ) {
    this.serverTools = createAgentServerTools(
      articleSource as AgentArticleSource,
    )
  }

  async run(
    payload: AgentRunPayload,
    { sink, signal, memory, inbox = createSteerInbox() }: AgentRunOptions,
  ): Promise<AgentRunResult> {
    const provider = await this.resolveProvider(payload.providerId)
    const runtime = createModelRuntime(provider, payload.model)
    if (!runtime.streamMessage) {
      throw new Error('runtime does not implement streamMessage')
    }

    const handle = await this.openTranscript(payload, memory, runtime)
    const { transcript } = handle

    const appendUser = (text: string, files: AgentFileSnapshot[]) => {
      const reconciled = reconcileFiles(transcript.known, files)
      transcript.known = reconciled.known
      if (reconciled.paths.length) {
        sink.emit({ type: 'reminder', paths: reconciled.paths })
      }
      transcript.messages.push({
        role: 'user',
        content: reconciled.reminder
          ? `${reconciled.reminder}\n\n${text}`
          : text,
        timestamp: Date.now(),
      })
    }
    const appendSteers = (steers: ReturnType<AgentSteerInbox['take']>) => {
      for (const steer of steers) appendUser(steer.user, steer.files)
      return steers.length > 0
    }
    const end = async (result: AgentRunResult) => {
      appendSteers(inbox.take({ close: true }))
      await handle.save()
      return result
    }

    appendUser(payload.user, payload.files)
    await handle.save()

    const serverNames = new Set(this.serverTools.map((t) => t.schema.name))
    const schemas: AgentToolSchema[] = [
      ...payload.tools.filter((t) => !serverNames.has(t.name)),
      ...this.serverTools.map((t) => t.schema),
    ]
    const clientNames = new Set(
      payload.tools.map((t) => t.name).filter((n) => !serverNames.has(n)),
    )
    const tools = schemas.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: convertJsonSchemaToTypeBox(t.parameters, {
        toolName: t.name,
      }),
    }))
    const systemPrompt = payload.system.length
      ? payload.system.join('\n\n')
      : undefined
    const excludeRefId = payload.sessionId.split(':')[1]

    for (let call = 0; call < MAX_MODEL_CALLS; call++) {
      if (signal.aborted) return end({ status: 'aborted' })

      let final: AssistantMessage | undefined
      let failure: { aborted: boolean; message: string } | undefined
      try {
        for await (const event of runtime.streamMessage({
          messages: transcript.messages,
          systemPrompt,
          tools,
          sessionId: payload.sessionId,
          signal,
        })) {
          const frame = mapPiEventToSse(event)
          if (frame) sink.emit(frame)
          if (event.type === 'done') final = event.message
          if (event.type === 'error') {
            final = event.error
            failure = {
              aborted: event.reason === 'aborted' || signal.aborted,
              message: event.error.errorMessage ?? 'Model stream failed',
            }
          }
        }
      } catch (error) {
        failure = {
          aborted: signal.aborted,
          message: (error as Error)?.message ?? 'Model stream failed',
        }
      }

      if (failure) {
        const partial = final && withoutToolCalls(final)
        if (partial?.content.length) transcript.messages.push(partial)
        return end(
          failure.aborted
            ? { status: 'aborted' }
            : { status: 'failed', error: failure.message },
        )
      }
      if (!final) {
        return end({
          status: 'failed',
          error: 'Model stream ended without a reply',
        })
      }

      transcript.messages.push(final)
      const calls = final.content.filter(
        (block): block is ToolCall => block.type === 'toolCall',
      )
      if (!calls.length) {
        if (appendSteers(inbox.take())) {
          await handle.save()
          continue
        }
        return end({ status: 'complete' })
      }

      for (const toolCall of calls) {
        if (signal.aborted) {
          transcript.messages.push(toolResult(toolCall, 'Aborted', true))
          continue
        }
        const outcome = await this.executeTool(toolCall, {
          sink,
          serverNames,
          clientNames,
          excludeRefId,
          onFiles: (files) => {
            transcript.known = recordFiles(transcript.known, files)
          },
        })
        transcript.messages.push(
          toolResult(toolCall, outcome.content, outcome.isError),
        )
      }
      appendSteers(inbox.take())
      await handle.save()
    }

    return end({ status: 'failed', error: 'Too many model calls in one turn' })
  }

  private async executeTool(
    toolCall: ToolCall,
    context: {
      sink: AgentRunSink
      serverNames: Set<string>
      clientNames: Set<string>
      excludeRefId?: string
      onFiles: (files: NonNullable<AgentToolResultPayload['files']>) => void
    },
  ): Promise<{ content: string; isError: boolean }> {
    const args = (toolCall.arguments ?? {}) as Record<string, unknown>
    if (context.serverNames.has(toolCall.name)) {
      const tool = this.serverTools.find(
        (t) => t.schema.name === toolCall.name,
      )!
      let outcome: { content: string; isError: boolean }
      try {
        outcome = await tool.execute(args, {
          excludeRefId: context.excludeRefId,
        })
      } catch (error) {
        this.logger.warn(
          `server tool ${toolCall.name} failed: ${(error as Error).message}`,
        )
        outcome = {
          content: `Tool failed: ${(error as Error).message}`,
          isError: true,
        }
      }
      context.sink.emit({
        type: 'tool_result',
        toolCallId: toolCall.id,
        name: toolCall.name,
        ...outcome,
      })
      return outcome
    }

    if (context.clientNames.has(toolCall.name)) {
      try {
        const result = await context.sink.callClientTool({
          toolCallId: toolCall.id,
          name: toolCall.name,
          arguments: args,
        })
        if (result.files?.length) context.onFiles(result.files)
        return { content: result.content, isError: result.isError }
      } catch (error) {
        return {
          content: `Tool did not complete: ${(error as Error).message}`,
          isError: true,
        }
      }
    }

    return {
      content: `Tool "${toolCall.name}" is not available.`,
      isError: true,
    }
  }

  private async openTranscript(
    payload: AgentRunPayload,
    memory: Map<string, AgentTranscript>,
    runtime: ReturnType<typeof createModelRuntime>,
  ): Promise<TranscriptHandle> {
    if (!payload.conversationId) {
      let transcript = memory.get(payload.sessionId)
      if (!transcript) {
        transcript = { messages: [], known: {} }
        memory.set(payload.sessionId, transcript)
      }
      return { transcript, save: async () => {} }
    }

    const conversationId = payload.conversationId
    const row =
      await this.conversationRepository.findWithTranscript(conversationId)
    if (!row) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
    }
    const stored = row.transcript as AgentTranscript | null
    const transcript: AgentTranscript = stored?.messages
      ? { messages: stored.messages, known: stored.known ?? {} }
      : {
          messages: toPiMessages(
            withoutPendingUser(bubblesToHistory(row.messages), payload.user),
            runtime.providerInfo,
          ).piMessages,
          known: {},
        }
    return {
      transcript,
      save: async () => {
        await this.conversationRepository.saveTranscript(
          conversationId,
          transcript as unknown as Record<string, unknown>,
        )
      },
    }
  }

  private async resolveProvider(providerId: string) {
    const aiConfig = await this.configService.get('ai')
    const provider = aiConfig.providers?.find(
      (p) => p.id === providerId && p.enabled,
    )
    if (!provider) {
      throw createAppException(AppErrorCode.AI_NOT_ENABLED, {
        message: `Provider "${providerId}" not found or disabled`,
      })
    }
    return provider
  }
}

function toolResult(
  toolCall: ToolCall,
  text: string,
  isError: boolean,
): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: 'text', text }],
    isError,
    timestamp: Date.now(),
  }
}

function withoutPendingUser(
  history: Record<string, unknown>[],
  user: string,
): Record<string, unknown>[] {
  const last = history.at(-1)
  return last?.role === 'user' && String(last.content).trim() === user.trim()
    ? history.slice(0, -1)
    : history
}

function withoutToolCalls(message: AssistantMessage): AssistantMessage {
  return {
    ...message,
    content: message.content.filter((block) => block.type !== 'toolCall'),
  }
}
