import {
  type AgentDonePayload,
  type AgentEventPayload,
  type AgentToolCallPayload,
  type AgentToolResultPayload,
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

import { type AgentTranscript, AiAgentRunService } from './ai-agent-run.service'
import { acquireConversationRunLock } from './ai-agent-run-lock'
import { type AgentSteerInbox, createSteerInbox } from './ai-agent-steer'

const fileSnapshot = z.object({
  path: z.string().min(1).max(256),
  content: z.string(),
  attach: z.boolean().optional(),
})

const runSchema = z.object({
  runId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(256),
  conversationId: z.string().min(1).nullable(),
  model: z.string().min(1),
  providerId: z.string().min(1),
  system: z.array(z.string()),
  user: z.string(),
  tools: z.array(
    z.object({
      name: z.string().min(1).max(128),
      description: z.string(),
      parameters: z.record(z.string(), z.unknown()),
    }),
  ),
  files: z.array(fileSnapshot),
})

const toolResultSchema = z.object({
  runId: z.string().min(1),
  toolCallId: z.string().min(1),
  content: z.string(),
  isError: z.boolean(),
  files: z.array(fileSnapshot).optional(),
})

const cancelSchema = z.object({ runId: z.string().min(1) })

const steerSchema = z.object({
  runId: z.string().min(1),
  user: z.string().min(1),
  files: z.array(fileSnapshot),
})

interface PendingToolCall {
  resolve: (result: Omit<AgentToolResultPayload, 'runId'>) => void
  reject: (error: Error) => void
}

interface ActiveRun {
  sessionId: string
  controller: AbortController
  pending: Map<string, PendingToolCall>
  inbox: AgentSteerInbox
}

interface ConnectionState {
  runs: Map<string, ActiveRun>
  memory: Map<string, AgentTranscript>
}

@Injectable()
export class AiAgentWsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiAgentWsHandler.name)
  private readonly connections = new Map<string, ConnectionState>()
  private readonly disposers: Array<() => void> = []

  constructor(
    private readonly registry: AdminWsHandlerRegistry,
    private readonly runService: AiAgentRunService,
    private readonly redisService: RedisService,
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

    const releaseLock = payload.conversationId
      ? await acquireConversationRunLock(
          this.redisService.getClient(),
          payload.conversationId,
          (error, phase) =>
            this.logger.warn(
              `agent run lock ${phase} failed: ${error.message}`,
            ),
        )
      : null
    if (payload.conversationId && !releaseLock) {
      return { ok: false, code: 'AGENT_BUSY' }
    }

    const state = this.stateOf(ctx.connectionId)
    const busy =
      state.runs.has(payload.runId) ||
      [...state.runs.values()].some(
        (active) => active.sessionId === payload.sessionId,
      )
    if (busy) {
      await releaseLock?.()
      return { ok: false, code: 'AGENT_BUSY' }
    }

    const run: ActiveRun = {
      sessionId: payload.sessionId,
      controller: new AbortController(),
      pending: new Map(),
      inbox: createSteerInbox(),
    }
    state.runs.set(payload.runId, run)
    const { runId } = payload

    const finish = (done: Omit<AgentDonePayload, 'runId'>) => {
      state.runs.delete(runId)
      run.inbox.take({ close: true })
      void releaseLock?.()
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
      .run(payload, {
        signal: run.controller.signal,
        memory: state.memory,
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
      })
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

    return { ok: true }
  }

  private handleToolResult(ctx: AdminWsContext, raw: unknown): WsAckPayload {
    const parsed = toolResultSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' }
    const { runId, ...result } = parsed.data
    const run = this.connections.get(ctx.connectionId)?.runs.get(runId)
    const pending = run?.pending.get(result.toolCallId)
    if (!run || !pending) return { ok: false, code: 'UNKNOWN_TOOL_CALL' }
    run.pending.delete(result.toolCallId)
    pending.resolve(result)
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

  private handleSteer(ctx: AdminWsContext, raw: unknown): WsAckPayload {
    const parsed = steerSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' }
    const { runId, ...steer } = parsed.data
    const run = this.connections.get(ctx.connectionId)?.runs.get(runId)
    if (!run || run.controller.signal.aborted || !run.inbox.push(steer)) {
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
      state = { runs: new Map(), memory: new Map() }
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
