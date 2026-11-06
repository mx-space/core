import {
  type AgentDonePayload,
  type AgentEventPayload,
  type AgentToolCallPayload,
  AgentWsEvents,
} from '@mx-space/ai'
import type { WsAckPayload } from '@mx-space/ws-client/protocol'
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common'
import { z } from 'zod'

import {
  type AdminWsContext,
  AdminWsHandlerRegistry,
} from '~/processors/gateway/admin/admin-ws-handler.registry'
import { RedisService } from '~/processors/redis/redis.service'

import { AiAgentConversationRepository } from './ai-agent-conversation.repository'
import {
  type AgentClientToolResult,
  AiAgentRunService,
} from './ai-agent-run.service'
import { acquireConversationRunLock } from './ai-agent-run-lock'
import { type AgentSteerInbox, createSteerInbox } from './ai-agent-steer'
import {
  type AgentWireContext,
  createAgentWireContext,
  type WireResult,
} from './ai-agent-wire-context'

const filePath = z.string().min(1).max(256)
const fileFrame = z.union([
  z.object({
    path: filePath,
    attach: z.boolean().optional(),
    content: z.string(),
  }),
  z.object({
    path: filePath,
    attach: z.boolean().optional(),
    baseHash: z.string().min(1),
    patch: z.string(),
  }),
  z.object({
    path: filePath,
    attach: z.boolean().optional(),
    hash: z.string().min(1),
  }),
])

const toolSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string(),
  parameters: z.record(z.string(), z.unknown()),
})

const runSchema = z.object({
  runId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(256),
  conversationId: z.string().min(1).nullable(),
  model: z.string().min(1),
  providerId: z.string().min(1),
  user: z.string(),
  systemHash: z.string().min(1),
  system: z.array(z.string()).optional(),
  toolsHash: z.string().min(1),
  tools: z.array(toolSchema).optional(),
  files: z.array(fileFrame),
})

const toolResultSchema = z.object({
  runId: z.string().min(1),
  toolCallId: z.string().min(1),
  content: z.string(),
  isError: z.boolean(),
  files: z.array(fileFrame).optional(),
})

const cancelSchema = z.object({ runId: z.string().min(1) })

const steerSchema = z.object({
  runId: z.string().min(1),
  user: z.string().min(1),
  files: z.array(fileFrame),
})

interface PendingToolCall {
  resolve: (result: AgentClientToolResult) => void
  reject: (error: Error) => void
}

interface ActiveRun {
  sessionId: string
  conversationId: string
  controller: AbortController
  pending: Map<string, PendingToolCall>
  inbox: AgentSteerInbox
}

interface ConnectionState {
  runs: Map<string, ActiveRun>
  starting: Set<string>
  wire: AgentWireContext
}

const nack = (result: Exclude<WireResult<unknown>, { ok: true }>) =>
  result as WsAckPayload

@Injectable()
export class AiAgentWsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiAgentWsHandler.name)
  private readonly connections = new Map<string, ConnectionState>()
  private readonly disposers: Array<() => void> = []

  constructor(
    private readonly registry: AdminWsHandlerRegistry,
    private readonly runService: AiAgentRunService,
    private readonly redisService: RedisService,
    private readonly conversationRepository: AiAgentConversationRepository,
  ) {}

  onModuleInit() {
    this.disposers.push(
      this.registry.register(AgentWsEvents.run, (ctx, payload) =>
        this.handleRun(ctx, payload),
      ),
      this.registry.register(AgentWsEvents.toolResult, (ctx, payload) =>
        this.handleToolResult(ctx, payload),
      ),
      this.registry.register(AgentWsEvents.cancel, (ctx, payload) =>
        this.handleCancel(ctx, payload),
      ),
      this.registry.register(AgentWsEvents.steer, (ctx, payload) =>
        this.handleSteer(ctx, payload),
      ),
      this.registry.onDisconnect((connectionId) =>
        this.dropConnection(connectionId),
      ),
    )
  }

  onModuleDestroy() {
    for (const dispose of this.disposers.splice(0)) dispose()
    for (const connectionId of this.connections.keys()) {
      this.dropConnection(connectionId)
    }
  }

  private async handleRun(
    ctx: AdminWsContext,
    raw: unknown,
  ): Promise<WsAckPayload> {
    if (!canUseAgent(ctx)) return { ok: false, code: 'FORBIDDEN' }
    const parsed = runSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' }
    const payload = parsed.data
    const state = this.stateOf(ctx.connectionId)

    const busy =
      state.runs.has(payload.runId) ||
      state.starting.has(payload.sessionId) ||
      [...state.runs.values()].some(
        (active) => active.sessionId === payload.sessionId,
      )
    if (busy) return { ok: false, code: 'AGENT_BUSY' }

    state.starting.add(payload.sessionId)
    try {
      return await this.startRun(ctx, state, payload)
    } finally {
      state.starting.delete(payload.sessionId)
    }
  }

  private async startRun(
    ctx: AdminWsContext,
    state: ConnectionState,
    payload: z.infer<typeof runSchema>,
  ): Promise<WsAckPayload> {
    const statics = await state.wire.resolveStatic(payload)
    if (!statics.ok) return nack(statics)
    const pendingKey = `pending:${payload.runId}`
    const files = await state.wire.resolveFiles(
      payload.conversationId ?? pendingKey,
      payload.files,
    )
    if (!files.ok) return nack(files)

    let conversationId = payload.conversationId
    if (!conversationId) {
      const created = await this.conversationRepository.create({
        sessionId: payload.sessionId,
        model: payload.model,
        providerId: payload.providerId,
      })
      conversationId = String(created.id)
      state.wire.moveBaseline(pendingKey, conversationId)
    }

    const releaseLock = await acquireConversationRunLock(
      this.redisService.getClient(),
      conversationId,
      (error, phase) =>
        this.logger.warn(`agent run lock ${phase} failed: ${error.message}`),
    )
    if (!releaseLock) return { ok: false, code: 'AGENT_BUSY' }

    const run: ActiveRun = {
      sessionId: payload.sessionId,
      conversationId,
      controller: new AbortController(),
      pending: new Map(),
      inbox: createSteerInbox(),
    }
    state.runs.set(payload.runId, run)
    const { runId } = payload

    const finish = (done: Omit<AgentDonePayload, 'runId'>) => {
      state.runs.delete(runId)
      run.inbox.take({ close: true })
      void releaseLock()
      for (const pending of run.pending.values()) {
        pending.reject(new Error('Run ended'))
      }
      run.pending.clear()
      ctx.send(AgentWsEvents.done, {
        runId,
        ...done,
      } satisfies AgentDonePayload)
    }

    this.runService
      .run(
        {
          runId,
          sessionId: payload.sessionId,
          conversationId,
          model: payload.model,
          providerId: payload.providerId,
          user: payload.user,
          system: statics.value.system,
          tools: statics.value.tools,
          files: files.value,
        },
        {
          signal: run.controller.signal,
          inbox: run.inbox,
          sink: {
            emit: (event) =>
              ctx.send(AgentWsEvents.event, {
                runId,
                event,
              } satisfies AgentEventPayload),
            callClientTool: (call) =>
              new Promise((resolve, reject) => {
                if (run.controller.signal.aborted) {
                  reject(new Error('Run aborted'))
                  return
                }
                run.pending.set(call.toolCallId, { resolve, reject })
                ctx.send(AgentWsEvents.toolCall, {
                  runId,
                  ...call,
                } satisfies AgentToolCallPayload)
              }),
          },
        },
      )
      .then(
        (result) => finish(result),
        (error: Error) => {
          this.logger.warn(`agent run ${runId} failed: ${error.message}`)
          finish({
            status: run.controller.signal.aborted ? 'aborted' : 'failed',
            error: error.message,
          })
        },
      )

    return { ok: true, conversationId }
  }

  private async handleToolResult(
    ctx: AdminWsContext,
    raw: unknown,
  ): Promise<WsAckPayload> {
    const parsed = toolResultSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' }
    const { runId, files: frames, ...result } = parsed.data
    const state = this.connections.get(ctx.connectionId)
    const run = state?.runs.get(runId)
    const pending = run?.pending.get(result.toolCallId)
    if (!state || !run || !pending) {
      return { ok: false, code: 'UNKNOWN_TOOL_CALL' }
    }
    let files: AgentClientToolResult['files']
    if (frames?.length) {
      const resolved = await state.wire.resolveFiles(run.conversationId, frames)
      if (!resolved.ok) return nack(resolved)
      files = resolved.value
    }
    if (run.pending.get(result.toolCallId) !== pending) {
      return { ok: false, code: 'UNKNOWN_TOOL_CALL' }
    }
    run.pending.delete(result.toolCallId)
    pending.resolve(files ? { ...result, files } : result)
    return { ok: true }
  }

  private handleCancel(ctx: AdminWsContext, raw: unknown): WsAckPayload {
    const parsed = cancelSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' }
    const run = this.connections
      .get(ctx.connectionId)
      ?.runs.get(parsed.data.runId)
    if (run) abortRun(run)
    return { ok: true }
  }

  private async handleSteer(
    ctx: AdminWsContext,
    raw: unknown,
  ): Promise<WsAckPayload> {
    const parsed = steerSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' }
    const { runId, user, files: frames } = parsed.data
    const state = this.connections.get(ctx.connectionId)
    const run = state?.runs.get(runId)
    if (!state || !run || run.controller.signal.aborted) {
      return { ok: false, code: 'RUN_ENDED' }
    }
    const files = await state.wire.resolveFiles(run.conversationId, frames)
    if (!files.ok) return nack(files)
    if (!run.inbox.push({ user, files: files.value })) {
      return { ok: false, code: 'RUN_ENDED' }
    }
    return { ok: true }
  }

  private dropConnection(connectionId: string) {
    const state = this.connections.get(connectionId)
    if (!state) return
    this.connections.delete(connectionId)
    for (const run of state.runs.values()) abortRun(run)
  }

  private stateOf(connectionId: string) {
    let state = this.connections.get(connectionId)
    if (!state) {
      state = {
        runs: new Map(),
        starting: new Set(),
        wire: createAgentWireContext(),
      }
      this.connections.set(connectionId, state)
    }
    return state
  }
}

function abortRun(run: ActiveRun) {
  run.controller.abort()
  for (const pending of run.pending.values()) {
    pending.reject(new Error('Run aborted'))
  }
  run.pending.clear()
}

// Collab will admit reader sessions on this gateway; per-event authorization
// belongs here so the agent never relies on "connected means owner".
function canUseAgent(_ctx: AdminWsContext) {
  return true
}
