import type {
  AssistantMessage,
  Message as PiMessage,
  ToolCall,
  ToolResultMessage,
} from '@earendil-works/pi-ai'
import type {
  AgentFileSnapshot,
  AgentRunStatus,
  AgentServerEvent,
  AgentToolSchema,
  ResolvedAgentRun,
} from '@mx-space/ai'
import {
  convertJsonSchemaToTypeBox,
  createModelRuntime,
} from '@mx-space/ai/runtime'
import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import { ConfigsService } from '~/modules/configs/configs.service'
import { FileReferenceService } from '~/modules/file/file-reference.service'

import { AiAgentArticleSource } from './ai-agent-article.source'
import { AiAgentConversationRepository } from './ai-agent-conversation.repository'
import {
  type AgentToolImage,
  createImageLoader,
  hydrateImages,
  toolResultContent,
  userContent,
} from './ai-agent-images'
import { mapPiEventToSse } from './ai-agent-messages'
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

export interface AgentClientToolResult {
  toolCallId: string
  content: string
  isError: boolean
  files?: AgentFileSnapshot[]
  images?: AgentToolImage[]
}

export interface AgentRunSink {
  emit: (event: AgentServerEvent) => void
  callClientTool: (call: {
    toolCallId: string
    name: string
    arguments: Record<string, unknown>
  }) => Promise<AgentClientToolResult>
}

export interface AgentRunOptions {
  sink: AgentRunSink
  signal: AbortSignal
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
    private readonly fileReferenceService: FileReferenceService,
  ) {
    this.serverTools = createAgentServerTools(
      articleSource as AgentArticleSource,
    )
  }

  async run(
    payload: ResolvedAgentRun,
    { sink, signal, inbox = createSteerInbox() }: AgentRunOptions,
  ): Promise<AgentRunResult> {
    const provider = await this.resolveProvider(payload.providerId)
    const runtime = createModelRuntime(provider, payload.model)
    const loadImage = createImageLoader({
      allowedHosts: await this.fileReferenceService.collectAllowedImageHosts(),
    })
    if (!runtime.streamMessage) {
      throw new Error('runtime does not implement streamMessage')
    }

    const handle = await this.openTranscript(payload.conversationId)
    const { transcript } = handle

    const appendUser = (
      text: string,
      files: AgentFileSnapshot[],
      images?: AgentToolImage[],
    ) => {
      const reconciled = reconcileFiles(transcript.known, files)
      transcript.known = reconciled.known
      if (reconciled.paths.length) {
        sink.emit({ type: 'reminder', paths: reconciled.paths })
      }
      transcript.messages.push({
        role: 'user',
        content: userContent(
          reconciled.reminder ? `${reconciled.reminder}\n\n${text}` : text,
          images,
        ),
        timestamp: Date.now(),
      })
    }
    const appendSteers = (steers: ReturnType<AgentSteerInbox['take']>) => {
      for (const steer of steers)
        appendUser(steer.user, steer.files, steer.images)
      return steers.length > 0
    }
    const end = async (result: AgentRunResult) => {
      appendSteers(inbox.take({ close: true }))
      await handle.save()
      return result
    }

    appendUser(payload.user, payload.files, payload.images)
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
          messages: await hydrateImages(transcript.messages, loadImage),
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
          toolResult(
            toolCall,
            outcome.content,
            outcome.isError,
            outcome.images,
          ),
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
      onFiles: (files: AgentFileSnapshot[]) => void
    },
  ): Promise<{ content: string; isError: boolean; images?: AgentToolImage[] }> {
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
        return {
          content: result.content,
          isError: result.isError,
          images: result.images,
        }
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
    conversationId: string,
  ): Promise<TranscriptHandle> {
    const row =
      await this.conversationRepository.findWithTranscript(conversationId)
    if (!row) {
      throw createAppException(AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS, {
        message: 'Conversation not found',
      })
    }
    const stored = row.transcript as Partial<AgentTranscript>
    const transcript: AgentTranscript = {
      messages: stored.messages ?? [],
      known: stored.known ?? {},
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
  images?: AgentToolImage[],
): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: toolResultContent(text, images),
    isError,
    timestamp: Date.now(),
  }
}

function withoutToolCalls(message: AssistantMessage): AssistantMessage {
  return {
    ...message,
    content: message.content.filter((block) => block.type !== 'toolCall'),
  }
}
